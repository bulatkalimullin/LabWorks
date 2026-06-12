"""
JWT with fixed absolute session end (login + lifetime, capped at Moscow midnight).

Sessions never extend on refresh. After 00:00 MSK all sessions from previous days are invalid.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.utils import datetime_from_epoch


def get_session_lifetime():
    return settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']


def get_session_tz() -> ZoneInfo:
    return ZoneInfo(getattr(settings, 'SESSION_TIME_ZONE', settings.TIME_ZONE))


def moscow_midnight_after(local_dt: datetime) -> datetime:
    """00:00:00 MSK on the next calendar day after local_dt."""
    next_day = local_dt.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, tzinfo=local_dt.tzinfo)


def compute_session_exp(from_time=None) -> int:
    """Session ends at min(login + lifetime, 00:00 MSK next calendar day)."""
    base = from_time or timezone.now()
    local = base.astimezone(get_session_tz())
    lifetime_end = local + get_session_lifetime()
    midnight_next = moscow_midnight_after(local)
    session_end = min(lifetime_end, midnight_next)
    return int(session_end.timestamp())


class LabworksAccessToken(AccessToken):
    token_type = 'access'


class LabworksRefreshToken(RefreshToken):
    token_type = 'refresh'

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        login_at = timezone.now()
        session_start = int(login_at.timestamp())
        session_exp = compute_session_exp(login_at)
        token['session_start'] = session_start
        token['session_exp'] = session_exp
        token['session_tz'] = settings.SESSION_TIME_ZONE
        token.payload['exp'] = int(session_exp)

        jti = token[api_settings.JTI_CLAIM]
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        OutstandingToken.objects.filter(jti=jti).update(
            token=str(token),
            expires_at=datetime_from_epoch(session_exp),
        )
        return token

    @property
    def access_token(self):
        access = LabworksAccessToken()
        access.set_jti()
        access.set_iat()

        user_id = self.payload.get('user_id')
        if user_id is not None:
            access['user_id'] = user_id

        session_start = self.payload.get('session_start')
        if session_start is not None:
            access['session_start'] = session_start

        session_exp = self.payload.get('session_exp')
        if session_exp is not None:
            access['session_exp'] = session_exp
            session_tz = self.payload.get('session_tz')
            if session_tz is not None:
                access['session_tz'] = session_tz
            access.payload['exp'] = int(session_exp)
        else:
            access.set_exp(from_time=self.current_time)

        return access


def assert_moscow_day_valid(session_start_unix: int) -> None:
    tz = get_session_tz()
    now_local = timezone.now().astimezone(tz)
    start_local = datetime.fromtimestamp(int(session_start_unix), tz=tz)
    if now_local.date() > start_local.date():
        raise TokenError('Сессия истекла: начался новый день. Войдите снова.')


def assert_session_active(token: RefreshToken | LabworksAccessToken) -> None:
    session_start = token.payload.get('session_start')
    if session_start is not None:
        assert_moscow_day_valid(int(session_start))

    session_exp = token.payload.get('session_exp')
    if session_exp is not None:
        if timezone.now().timestamp() >= int(session_exp):
            raise TokenError('Сессия истекла. Войдите снова.')
        return

    if session_start is not None:
        return
    iat = token.payload.get('iat')
    if iat is not None:
        assert_moscow_day_valid(int(iat))


class LabworksTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = LabworksRefreshToken

    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])
        assert_session_active(refresh)
        return super().validate(attrs)
