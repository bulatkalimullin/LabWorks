import hashlib
import hmac
import secrets
import zipfile
from io import BytesIO

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.http import HttpResponse, FileResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
import pyotp

from .models import Course, Assignment, Submission, StudentGroup, Comment, CustomUser, AssignmentEvent, STUDENT_LABELS
from .serializers import (
    CourseSerializer,
    AssignmentSerializer,
    SubmissionSerializer,
    AdminSubmissionSerializer,
    AdminUserSerializer,
    RegisterSerializer,
    CustomUserSerializer,
    StudentGroupSerializer,
    CommentSerializer,
    TokenObtainPairWith2FASerializer,
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    TwoFAEnableSerializer,
    TwoFADisableSerializer,
)
from .permissions import IsTeacher


RESET_TOKEN_CACHE_PREFIX = 'pwd_reset:'
RESET_TOKEN_TTL = 900  # 15 min


@api_view(['GET'])
@permission_classes([AllowAny])
def public_groups(request):
    return Response(StudentGroupSerializer(StudentGroup.objects.all()[:500], many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(CustomUserSerializer(request.user).data)


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': CustomUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class TokenObtainPairWith2FAView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = TokenObtainPairWith2FASerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password_change(request):
    ser = PasswordChangeSerializer(data=request.data, context={'request': request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response({'detail': 'Пароль изменён'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """По username выдаётся reset_token (одноразовый, 15 мин). Без email."""
    ser = PasswordResetRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    username = ser.validated_data['username']
    token = secrets.token_urlsafe(32)
    cache.set(f'{RESET_TOKEN_CACHE_PREFIX}{username}', token, RESET_TOKEN_TTL)
    return Response({
        'detail': 'Сохраните токен и используйте его в течение 15 минут.',
        'reset_token': token,
        'username': username,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    ser = PasswordResetConfirmSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    username = ser.validated_data['username']
    token = ser.validated_data['reset_token']
    new_password = ser.validated_data['new_password']
    cached = cache.get(f'{RESET_TOKEN_CACHE_PREFIX}{username}')
    if not cached or cached != token:
        return Response({'detail': 'Неверный или просроченный токен'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = CustomUser.objects.get(username=username)
    except CustomUser.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    user.set_password(new_password)
    user.save()
    cache.delete(f'{RESET_TOKEN_CACHE_PREFIX}{username}')
    return Response({'detail': 'Пароль обновлён'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def twofa_setup(request):
    """Генерирует секрет и otpauth URL для Google Authenticator."""
    user = request.user
    if user.totp_enabled:
        return Response({'detail': '2FA уже включена. Сначала отключите.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save(update_fields=['totp_secret'])
    totp = pyotp.TOTP(user.totp_secret)
    issuer = 'FileCompetition'
    otpauth_url = totp.provisioning_uri(name=user.username, issuer_name=issuer)
    return Response({
        'secret': user.totp_secret,
        'otpauth_url': otpauth_url,
        'detail': 'Добавьте в Google Authenticator по URL или введите секрет вручную.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def twofa_enable(request):
    user = request.user
    if user.totp_enabled:
        return Response({'detail': 'Уже включено'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.totp_secret:
        return Response({'detail': 'Сначала вызовите POST /auth/2fa/setup/'}, status=status.HTTP_400_BAD_REQUEST)
    ser = TwoFAEnableSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(ser.validated_data['code'].strip(), valid_window=1):
        return Response({'detail': 'Неверный код'}, status=status.HTTP_400_BAD_REQUEST)
    user.totp_enabled = True
    user.save(update_fields=['totp_enabled'])
    return Response({'detail': 'Google Authenticator подключён'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def twofa_disable(request):
    user = request.user
    if not user.totp_enabled:
        return Response({'detail': '2FA не включена'}, status=status.HTTP_400_BAD_REQUEST)
    ser = TwoFADisableSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    if not user.check_password(ser.validated_data['password']):
        return Response({'detail': 'Неверный пароль'}, status=status.HTTP_400_BAD_REQUEST)
    user.totp_enabled = False
    user.totp_secret = ''
    user.save(update_fields=['totp_enabled', 'totp_secret'])
    return Response({'detail': '2FA отключена'})


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.prefetch_related('images').all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTeacher()]
        return super().get_permissions()


class StudentGroupViewSet(viewsets.ModelViewSet):
    queryset = StudentGroup.objects.select_related('course').all()
    serializer_class = StudentGroupSerializer
    permission_classes = [IsAuthenticated, IsTeacher]


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        qs = Assignment.objects.select_related('course').prefetch_related('student_groups')
        if getattr(self.request.user, 'is_staff', False):
            return qs
        now = timezone.now()
        user_groups = self.request.user.student_groups.all()
        return qs.filter(
            student_groups__in=user_groups,
            open_time__lte=now,
            close_time__gte=now,
        ).distinct()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'submissions'):
            if self.action == 'submissions':
                return [IsAuthenticated(), IsTeacher()]
            return [IsAuthenticated(), IsTeacher()]
        return super().get_permissions()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['get'], url_path='submissions')
    def submissions(self, request, pk=None):
        assignment = self.get_object()
        qs = Submission.objects.filter(assignment=assignment).select_related('student').prefetch_related('comments__author')
        return Response(SubmissionSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='events', permission_classes=[IsAuthenticated])
    def record_event(self, request, pk=None):
        """Record OPEN_PAGE or START_WORK once per student per assignment."""
        if request.user.is_staff:
            return Response({'detail': 'ok'})
        assignment = self.get_object()
        event_type = request.data.get('event_type', '')
        if event_type not in ['OPEN_PAGE', 'START_WORK']:
            return Response({'detail': 'Invalid event_type'}, status=status.HTTP_400_BAD_REQUEST)
        exists = AssignmentEvent.objects.filter(
            student=request.user, assignment=assignment, event_type=event_type
        ).exists()
        if not exists:
            AssignmentEvent.objects.create(
                student=request.user, assignment=assignment, event_type=event_type
            )
        return Response({'detail': 'recorded'}, status=status.HTTP_201_CREATED)


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Submission.objects.select_related('assignment', 'student').prefetch_related('comments__author')
        if self.request.user.is_staff:
            assignment_id = self.request.query_params.get('assignment')
            if assignment_id:
                qs = qs.filter(assignment_id=assignment_id)
            return qs
        return qs.filter(student=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsTeacher()]
        return super().get_permissions()

    def perform_create(self, serializer):
        assignment = serializer.validated_data['assignment']
        if not self.request.user.is_staff:
            now = timezone.now()
            if not (assignment.open_time <= now <= assignment.close_time):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Задание недоступно по времени.')
            user_groups = self.request.user.student_groups.all()
            if not assignment.student_groups.filter(pk__in=user_groups).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Нет доступа к этому заданию.')
        submission = serializer.save(student=self.request.user)
        self._stamp_verification(submission, self.request)

    @staticmethod
    def _stamp_verification(submission, request):
        """Build HMAC-SHA256 verification payload and persist it to the DB."""
        user = submission.student
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR', '')
        ua = request.META.get('HTTP_USER_AGENT', '')
        created_iso = submission.submitted_at.isoformat()
        payload = (
            f"{ip}@{user.username}@{user.full_name}"
            f"@{submission.assignment_id}@{created_iso}@{ua}"
        )
        sig = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256,
        ).hexdigest()
        submission.verification_payload = payload
        submission.verification_signature = sig
        submission.save(update_fields=['verification_payload', 'verification_signature'])

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        submission = self.get_object()
        if not submission.file:
            return Response({'detail': 'Файл не прикреплён'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and submission.student_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        # После истечения срока студент не может скачать свою работу
        if not request.user.is_staff and timezone.now() > submission.assignment.close_time:
            return Response(
                {'detail': 'Срок сдачи истёк. Скачивание работы недоступно.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            file_handle = submission.file.open('rb')
        except Exception:
            raise Http404
        filename = submission.file.name.split('/')[-1]
        resp = FileResponse(file_handle, as_attachment=True, filename=filename)
        return resp

    @action(detail=True, methods=['get'], url_path='verify', permission_classes=[IsAuthenticated])
    def verify(self, request, pk=None):
        """Re-compute HMAC from stored payload and confirm signature validity."""
        submission = self.get_object()
        if not request.user.is_staff and submission.student_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not submission.verification_payload:
            return Response({'valid': False, 'detail': 'Верификационные данные отсутствуют.'})
        expected = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            submission.verification_payload.encode('utf-8'),
            hashlib.sha256,
        ).hexdigest()
        valid = hmac.compare_digest(expected, submission.verification_signature)
        return Response({
            'valid': valid,
            'payload': submission.verification_payload,
            'signature': submission.verification_signature,
        })

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        submission = self.get_object()
        if request.method == 'GET':
            if not request.user.is_staff and submission.student_id != request.user.id:
                return Response(status=status.HTTP_403_FORBIDDEN)
            qs = submission.comments.select_related('author')
            return Response(CommentSerializer(qs, many=True).data)
        if request.method == 'POST':
            if not request.user.is_staff:
                return Response(status=status.HTTP_403_FORBIDDEN)
            text = request.data.get('text', '').strip()
            if not text:
                return Response({'detail': 'Пустой комментарий'}, status=status.HTTP_400_BAD_REQUEST)
            c = Comment.objects.create(submission=submission, author=request.user, text=text)
            return Response(CommentSerializer(c).data, status=status.HTTP_201_CREATED)


class AdminSubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Staff-only: full submission list/detail with admin fields and timing."""
    serializer_class = AdminSubmissionSerializer
    permission_classes = [IsAuthenticated, IsTeacher]

    def get_queryset(self):
        qs = Submission.objects.select_related(
            'assignment__course', 'student'
        ).prefetch_related('comments__author')
        course_id = self.request.query_params.get('course')
        assignment_id = self.request.query_params.get('assignment')
        label = self.request.query_params.get('label')
        if course_id:
            qs = qs.filter(assignment__course_id=course_id)
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        if label:
            qs = qs.filter(student__label=label)
        return qs.order_by('-submitted_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['patch'], url_path='annotate')
    def annotate(self, request, pk=None):
        """Update admin_note, admin_flags, or the student's label."""
        submission = self.get_object()
        note = request.data.get('admin_note')
        flags = request.data.get('admin_flags')
        student_label = request.data.get('student_label')
        if note is not None:
            submission.admin_note = note
            submission.save(update_fields=['admin_note'])
        if flags is not None:
            submission.admin_flags = flags
            submission.save(update_fields=['admin_flags'])
        if student_label is not None:
            submission.student.label = student_label
            submission.student.save(update_fields=['label'])
        return Response(
            AdminSubmissionSerializer(submission, context={'request': request}).data
        )


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    """Staff-only: user list with label management."""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsTeacher]

    def get_queryset(self):
        qs = CustomUser.objects.prefetch_related('student_groups').order_by('full_name')
        label = self.request.query_params.get('label')
        is_staff = self.request.query_params.get('is_staff')
        search = self.request.query_params.get('search')
        if label is not None:
            qs = qs.filter(label=label)
        if is_staff == 'false':
            qs = qs.filter(is_staff=False)
        elif is_staff == 'true':
            qs = qs.filter(is_staff=True)
        if search:
            qs = qs.filter(
                models.Q(username__icontains=search) | models.Q(full_name__icontains=search)
            )
        return qs

    @action(detail=True, methods=['patch'], url_path='label')
    def set_label(self, request, pk=None):
        user = self.get_object()
        label = request.data.get('label', '')
        user.label = label
        user.save(update_fields=['label'])
        return Response({'detail': 'Метка обновлена', 'label': user.label})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher])
def admin_stats(request):
    from django.db.models import Count
    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)

    subs_by_day = []
    for i in range(13, -1, -1):
        day = now - timezone.timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
        count = Submission.objects.filter(
            submitted_at__gte=day_start, submitted_at__lte=day_end
        ).count()
        subs_by_day.append({'date': day_start.strftime('%d.%m'), 'count': count})

    label_distribution = {}
    for code, name in STUDENT_LABELS:
        if code:
            c = CustomUser.objects.filter(label=code, is_staff=False).count()
            if c > 0:
                label_distribution[name] = c

    top_assignments = list(
        Assignment.objects.annotate(sub_count=Count('submissions'))
        .order_by('-sub_count')[:8]
        .values('title', 'sub_count')
    )

    return Response({
        'total_students': CustomUser.objects.filter(is_staff=False).count(),
        'total_courses': Course.objects.count(),
        'total_assignments': Assignment.objects.count(),
        'total_submissions': Submission.objects.count(),
        'recent_submissions': Submission.objects.filter(submitted_at__gte=thirty_days_ago).count(),
        'submissions_by_day': subs_by_day,
        'label_distribution': label_distribution,
        'top_assignments': top_assignments,
        'student_labels': [{'code': c, 'name': n} for c, n in STUDENT_LABELS if c],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher])
def export_course_submissions(request, course_id):
    submissions = Submission.objects.filter(assignment__course_id=course_id).select_related('student', 'assignment')
    try:
        name = Course.objects.get(id=course_id).name
    except Course.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    from .utils.exports import build_zip_by_groups
    buffer = build_zip_by_groups(submissions, include_assignment_in_path=True)
    response = HttpResponse(buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{name}_submissions.zip"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher])
def export_group_submissions(request, group_id):
    submissions = Submission.objects.filter(student__student_groups__id=group_id).select_related('student', 'assignment')
    try:
        name = StudentGroup.objects.get(id=group_id).name
    except StudentGroup.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    from .utils.exports import build_zip_by_groups
    buffer = build_zip_by_groups(submissions, fixed_group_name=name, include_assignment_in_path=True)
    response = HttpResponse(buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{name}_submissions.zip"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher])
def export_assignment_submissions(request, assignment_id):
    try:
        assignment = Assignment.objects.get(pk=assignment_id)
    except Assignment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    submissions = Submission.objects.filter(assignment=assignment)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for submission in submissions:
            student_groups = submission.student.student_groups.filter(assignments=assignment)
            group_name = student_groups.first().name if student_groups.exists() else 'NoGroup'
            student_name = submission.student.full_name.replace('/', '_').replace('\\', '_')
            if submission.file:
                base_name = submission.file.name.split('/')[-1]
                arcname = f'{group_name}/{student_name}/{base_name}'
                try:
                    with submission.file.open('rb') as f:
                        zf.writestr(arcname, f.read())
                except Exception:
                    pass
            if submission.text_response:
                text_path = f'{group_name}/{student_name}/{submission.student.username}_{assignment.title}_text_response.txt'
                zf.writestr(text_path, submission.text_response)
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{assignment.title}_submissions.zip"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTeacher])
def export_smart_submissions(request, assignment_id):
    """Smart ZIP export with per-student folders and safe extraction."""
    from .utils.exports import build_smart_zip
    try:
        assignment = Assignment.objects.get(pk=assignment_id)
    except Assignment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    submissions = Submission.objects.filter(assignment=assignment).select_related('student')
    buffer = build_smart_zip(submissions)
    safe_title = assignment.title.replace('/', '_').replace('\\', '_')
    response = HttpResponse(buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{safe_title}_smart.zip"'
    return response


def _zip_response(submissions, filename):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for submission in submissions:
            if submission.file:
                try:
                    arcname = f'{submission.student.username}_{submission.assignment.title}.{submission.file.name.split(".")[-1]}'
                    with submission.file.open('rb') as f:
                        zf.writestr(arcname, f.read())
                except Exception:
                    pass
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename={filename}'
    return response
