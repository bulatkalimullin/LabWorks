
from django import template
import hashlib
import hmac

from django.conf import settings

register = template.Library()

@register.filter
def intersection(queryset1, queryset2):
    return queryset1.filter(pk__in=queryset2.values('pk'))


@register.filter
def submission_download_hash(submission_uuid, download_salt) -> str:
    """
    Compute the required `h` query param for /api/v1/submissions/<uuid>/download/.
    Uses HMAC-SHA256 over "<uuid>:<salt>" with settings.SECRET_KEY.
    """
    if not submission_uuid or not download_salt:
        return ''
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        f'{submission_uuid}:{download_salt}'.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()
