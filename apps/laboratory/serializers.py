from datetime import datetime
import hashlib
import hmac
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
import pyotp

from .models import (
    CustomUser, Course, CourseImage, StudentGroup, Assignment,
    Submission, Comment, AssignmentEvent, STUDENT_LABELS, LoginLog,
)


def _persist_refresh_token(refresh, user):
    """Ensure refresh token is stored in OutstandingToken for single-session blacklisting."""
    if hasattr(refresh, 'outstand'):
        refresh.outstand()
        return
    payload = getattr(refresh, 'payload', None) or {}
    jti = payload.get('jti')
    exp = payload.get('exp')
    if jti and exp is not None:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        OutstandingToken.objects.get_or_create(
            jti=jti,
            defaults={'user': user, 'token': str(refresh), 'expires_at': expires_at},
        )


def _compute_submission_download_hash(submission) -> str:
    """
    Download hash required by SubmissionViewSet.download.
    Derived from (submission.uuid + submission.download_salt) via HMAC-SHA256.
    """
    salt = getattr(submission, 'download_salt', '') or ''
    uuid_val = getattr(submission, 'uuid', None)
    if not uuid_val or not salt:
        return ''
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        f'{uuid_val}:{salt}'.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


class StudentGroupSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)

    class Meta:
        model = StudentGroup
        fields = ('id', 'name', 'course', 'course_name')


class CourseImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = CourseImage
        fields = ('id', 'image', 'title', 'order')

    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        if obj.image:
            return obj.image.url
        return None


class CourseSerializer(serializers.ModelSerializer):
    images = CourseImageSerializer(many=True, read_only=True)
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ('id', 'name', 'images', 'cover_image')

    def get_cover_image(self, obj):
        first = obj.images.first()
        if not first or not first.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(first.image.url)
        return first.image.url


class AssignmentSerializer(serializers.ModelSerializer):
    student_groups = serializers.PrimaryKeyRelatedField(
        many=True, queryset=StudentGroup.objects.all(), required=False
    )
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    submissions_count = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Assignment
        fields = (
            'id', 'title', 'description', 'course', 'course_id', 'course_name',
            'student_groups', 'allowed_extensions', 'open_time', 'close_time',
            'files', 'file_url', 'submissions_count',
        )
        read_only_fields = ('id', 'file_url')

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_file_url(self, obj):
        if not obj.files:
            return None
        # Always return relative URL; it will be fetched with auth.
        return f'/api/v1/assignments/{obj.id}/download-file/'


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_full_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'submission', 'author', 'author_username', 'author_full_name', 'text', 'created_at')
        read_only_fields = ('id', 'author', 'created_at')


class SubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    assignment_close_time = serializers.DateTimeField(source='assignment.close_time', read_only=True)
    file_url = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    verification_short = serializers.SerializerMethodField()
    verification_payload = serializers.SerializerMethodField()
    verification_signature = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            'id', 'assignment', 'student', 'student_username',
            'assignment_title', 'assignment_close_time', 'file', 'file_url', 'text_response',
            'submitted_at', 'comments',
            'verification_short', 'verification_payload', 'verification_signature',
        )
        read_only_fields = ('id', 'student', 'submitted_at', 'comments',
                            'verification_short', 'verification_payload', 'verification_signature')

    def get_file_url(self, obj):
        if obj.file:
            h = _compute_submission_download_hash(obj)
            return f'/api/v1/submissions/{obj.uuid}/download/?h={h}'
        return None

    def get_verification_short(self, obj):
        if obj.verification_signature:
            return obj.verification_signature[:16]
        return None

    def get_verification_payload(self, obj):
        request = self.context.get('request')
        if request and (request.user.is_staff or obj.student_id == request.user.id):
            return obj.verification_payload or None
        return None

    def get_verification_signature(self, obj):
        request = self.context.get('request')
        if request and request.user.is_staff:
            return obj.verification_signature or None
        return None

    def validate(self, attrs):
        file = attrs.get('file')
        text = attrs.get('text_response')
        if self.instance is None:
            if not file and not (text and text.strip()):
                raise serializers.ValidationError(
                    'Необходимо указать файл и/или текстовый ответ.'
                )
        assignment = attrs.get('assignment') or (self.instance.assignment if self.instance else None)
        if assignment and file and hasattr(file, 'name'):
            ext = file.name.split('.')[-1].lower() if '.' in file.name else ''
            allowed = [e.strip().lower() for e in assignment.allowed_extensions.split(',') if e.strip()]
            if ext and allowed and ext not in allowed:
                raise serializers.ValidationError({
                    'file': f'Недопустимое расширение. Разрешены: {", ".join(allowed)}'
                })
        return attrs


class CustomUserSerializer(serializers.ModelSerializer):
    totp_enabled = serializers.BooleanField(read_only=True)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'full_name', 'is_staff', 'totp_enabled', 'label')
        read_only_fields = ('id', 'is_staff', 'totp_enabled')


class AdminUserSerializer(serializers.ModelSerializer):
    submissions_count = serializers.SerializerMethodField()
    student_groups_names = serializers.SerializerMethodField()
    label_display = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'full_name', 'is_staff', 'is_active',
            'label', 'label_display', 'totp_enabled',
            'submissions_count', 'student_groups_names', 'date_joined',
        )
        read_only_fields = ('id', 'is_staff', 'date_joined', 'totp_enabled')

    def get_submissions_count(self, obj):
        return obj.submission_set.count()

    def get_student_groups_names(self, obj):
        return list(obj.student_groups.values_list('name', flat=True))

    def get_label_display(self, obj):
        if not obj.label:
            return ''
        return dict(STUDENT_LABELS).get(obj.label, obj.label)


class AdminSubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    student_label = serializers.CharField(source='student.label', read_only=True)
    student_label_display = serializers.SerializerMethodField()
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    course_name = serializers.CharField(source='assignment.course.name', read_only=True)
    file_url = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    timing = serializers.SerializerMethodField()
    behavior_events = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            'id', 'assignment', 'assignment_title', 'course_name',
            'student', 'student_username', 'student_full_name',
            'student_label', 'student_label_display',
            'file', 'file_url', 'text_response', 'submitted_at', 'comments',
            'admin_note', 'admin_flags',
            'verification_payload', 'verification_signature',
            'timing',
            'behavior_clipboard_changes', 'behavior_paste_count', 'behavior_paste_chars',
            'behavior_keystrokes', 'behavior_tab_switches', 'behavior_gpt_score',
            'behavior_events',
        )
        read_only_fields = (
            'id', 'student', 'submitted_at', 'comments',
            'verification_payload', 'verification_signature', 'timing',
            'student_label', 'student_label_display',
            'behavior_clipboard_changes', 'behavior_paste_count', 'behavior_paste_chars',
            'behavior_keystrokes', 'behavior_tab_switches', 'behavior_gpt_score',
            'behavior_events',
        )

    def get_file_url(self, obj):
        if obj.file:
            h = _compute_submission_download_hash(obj)
            return f'/api/v1/submissions/{obj.uuid}/download/?h={h}'
        return None

    def get_student_label_display(self, obj):
        if not obj.student.label:
            return ''
        return dict(STUDENT_LABELS).get(obj.student.label, obj.student.label)

    def get_timing(self, obj):
        events = AssignmentEvent.objects.filter(
            student=obj.student, assignment=obj.assignment
        ).order_by('created_at')
        open_event = events.filter(event_type='OPEN_PAGE').first()
        start_event = events.filter(event_type='START_WORK').first()
        result = {
            'first_view_at': open_event.created_at.isoformat() if open_event else None,
            'first_start_at': start_event.created_at.isoformat() if start_event else None,
            'submit_at': obj.submitted_at.isoformat(),
            'time_from_view_to_submit': None,
            'time_from_start_to_submit': None,
        }
        if open_event:
            result['time_from_view_to_submit'] = int(
                (obj.submitted_at - open_event.created_at).total_seconds()
            )
        if start_event:
            result['time_from_start_to_submit'] = int(
                (obj.submitted_at - start_event.created_at).total_seconds()
            )
        return result

    def get_behavior_events(self, obj):
        """Return behavior events (clipboard changes, pastes, tab switches) with timestamps and metadata."""
        behavior_types = ('CLIPBOARD_CHANGE', 'PASTE_DETECTED', 'TAB_SWITCH', 'KEYLOG_BATCH')
        events = AssignmentEvent.objects.filter(
            student=obj.student,
            assignment=obj.assignment,
            event_type__in=behavior_types,
        ).order_by('created_at').values('event_type', 'created_at', 'metadata')
        return [
            {
                'event_type': e['event_type'],
                'created_at': e['created_at'].isoformat(),
                'metadata': e['metadata'],
            }
            for e in events
        ]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    student_group_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_full_name(self, value):
        words = value.strip().split()
        if len(words) < 2:
            raise serializers.ValidationError('ФИО должно содержать как минимум два слова.')
        for word in words:
            if len(word) < 2:
                raise serializers.ValidationError('Каждое слово в ФИО — минимум две буквы.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_username(self, value):
        if CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError('Пользователь с таким именем уже существует.')
        return value

    def create(self, validated_data):
        group_id = validated_data.pop('student_group_id', None)
        password = validated_data.pop('password')
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            full_name=validated_data['full_name'],
            password=password,
        )
        if group_id:
            try:
                group = StudentGroup.objects.get(pk=group_id)
                user.student_groups.add(group)
            except StudentGroup.DoesNotExist:
                pass
        return user


class TokenObtainPairWith2FASerializer(TokenObtainPairSerializer):
    """JWT login; if user has totp_enabled, totp_code is required."""
    totp_code = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        request = self.context.get('request')
        user = authenticate(request=request, username=username, password=password)
        if not user:
            raise serializers.ValidationError('Неверное имя пользователя или пароль.')
        if user.totp_enabled:
            code = (attrs.get('totp_code') or '').strip()
            if not code:
                raise serializers.ValidationError({'totp_code': 'Введите код из Google Authenticator'})
            secret = (user.totp_secret or '').strip().upper()
            totp = pyotp.TOTP(secret)
            if not totp.verify(code, valid_window=2):
                raise serializers.ValidationError({'totp_code': 'Неверный код'})
        # Log successful login
        ip = None
        user_agent = ''
        if request is not None:
            meta = request.META
            # Prefer X-Forwarded-For if present (behind proxy), fall back to REMOTE_ADDR
            xff = meta.get('HTTP_X_FORWARDED_FOR')
            if xff:
                ip = xff.split(',')[0].strip() or None
            else:
                ip = meta.get('REMOTE_ADDR')
            user_agent = meta.get('HTTP_USER_AGENT', '')
        LoginLog.objects.create(user=user, ip_address=ip, user_agent=user_agent)
        # Single-session: invalidate all previous refresh tokens for this user
        for ot in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=ot)
        refresh = self.get_token(user)
        # Persist new refresh token so it can be blacklisted on next login (single-session)
        _persist_refresh_token(refresh, user)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': CustomUserSerializer(user).data,
        }


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['current_password']):
            raise serializers.ValidationError({'current_password': 'Неверный текущий пароль'})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class ProfileUpdateSerializer(serializers.Serializer):
    """Редактирование ФИО текущего пользователя."""
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)

    def validate_full_name(self, value):
        if not (value or '').strip():
            raise serializers.ValidationError('ФИО не может быть пустым.')
        return value.strip()

    def save(self, **kwargs):
        user = self.context['request'].user
        user.full_name = self.validated_data['full_name']
        user.save(update_fields=['full_name'])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """По username возвращается totp_required (токен не выдаётся)."""
    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        if not CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError('Пользователь не найден.')
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    totp_code = serializers.CharField(max_length=10)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class TwoFAEnableSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10)


class TwoFADisableSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
