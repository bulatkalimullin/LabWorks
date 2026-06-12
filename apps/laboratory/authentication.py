from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .jwt import assert_session_active


class LabworksJWTAuthentication(JWTAuthentication):
    """JWT auth with fixed session window and Moscow midnight reset."""

    def get_validated_token(self, raw_token):
        validated = super().get_validated_token(raw_token)
        try:
            assert_session_active(validated)
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc
        return validated


class JWTAuthHeaderOrQuery(LabworksJWTAuthentication):
    """Accept JWT from Authorization header or ?access= query (for native file downloads)."""

    def get_header(self, request):
        header = super().get_header(request)
        if header is not None:
            return header
        raw = request.query_params.get('access')
        if raw:
            return f'Bearer {raw}'.encode('utf-8')
        return None
