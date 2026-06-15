import hmac
import os

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Submission


def _check_service_token(request) -> bool:
    expected = getattr(settings, 'DEPLOY_SERVICE_TOKEN', '') or os.environ.get('DEPLOY_SERVICE_TOKEN', '')
    if not expected:
        return False
    token = request.headers.get('X-Deploy-Service-Token', '')
    return hmac.compare_digest(expected, token)


@api_view(['GET'])
@permission_classes([AllowAny])
def internal_submission_file(request, submission_uuid):
    if not _check_service_token(request):
        return Response({'detail': 'Invalid service token'}, status=status.HTTP_403_FORBIDDEN)

    submission = Submission.objects.filter(uuid=submission_uuid).select_related('student').first()
    if not submission or not submission.file:
        raise Http404

    try:
        return FileResponse(
            submission.file.open('rb'),
            as_attachment=True,
            filename=submission.file.name.split('/')[-1],
        )
    except Exception as exc:
        raise Http404 from exc
