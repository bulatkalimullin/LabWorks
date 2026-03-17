
from django.db import models
from django.contrib.auth.models import AbstractUser, Group as AuthGroup
from uuid import uuid4

STUDENT_LABELS = [
    ('', '—'),
    ('strong', 'Сильный ученик'),
    ('above_avg', 'Выше среднего'),
    ('avg', 'Средний'),
    ('struggling', 'Слабый'),
    ('cheats', 'Списывает'),
    ('gpt', 'GPT'),
    ('gpt_suspected', 'Подозрение на GPT'),
    ('plagiarism', 'Плагиат'),
    ('plagiarism_suspected', 'Подозрение на плагиат'),
    ('inactive', 'Неактивный'),
    ('excellent', 'Отличник'),
    ('creative', 'Творческий подход'),
    ('hardworking', 'Трудолюбивый'),
    ('fast', 'Быстрый'),
    ('needs_help', 'Нуждается в помощи'),
    ('improving', 'Прогрессирует'),
    ('declining', 'Снизил активность'),
    ('leader', 'Лидер'),
    ('disruptive', 'Проблемный'),
    ('absent', 'Часто отсутствует'),
]

SUBMISSION_FLAGS = [
    'suspicious',
    'plagiarism',
    'gpt',
    'excellent',
    'accepted',
    'rejected',
    'needs_review',
    'revised',
    'incomplete',
    'strong_work',
]

SUBMISSION_FLAG_LABELS = {
    'suspicious': 'Подозрительное',
    'plagiarism': 'Плагиат',
    'gpt': 'GPT',
    'excellent': 'Отличная работа',
    'accepted': 'Зачтено',
    'rejected': 'Не зачтено',
    'needs_review': 'Требует проверки',
    'revised': 'Исправлена',
    'incomplete': 'Неполная',
    'strong_work': 'Сильная работа',
}


class CustomUser(AbstractUser):
    full_name = models.CharField(max_length=255)
    student_groups = models.ManyToManyField('StudentGroup', blank=True, related_name='students')
    groups = models.ManyToManyField(AuthGroup, blank=True, related_name='user_set')
    totp_secret = models.CharField(max_length=32, blank=True, default='')
    totp_enabled = models.BooleanField(default=False)
    label = models.CharField(max_length=32, choices=STUDENT_LABELS, blank=True)

    def __str__(self):
        return self.username


class Course(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class CourseImage(models.Model):
    """Фон/изображение курса (отображается на карточке и на странице курса с авто-прокруткой)."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='course_images/', verbose_name='Изображение')
    title = models.CharField(max_length=255, blank=True, verbose_name='Подпись')
    order = models.PositiveIntegerField(default=0, verbose_name='Порядок')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Фон курса'
        verbose_name_plural = 'Фоны курса'

    def __str__(self):
        return f"{self.course.name} — {self.order}"


class StudentGroup(models.Model):
    name = models.CharField(max_length=100)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='student_groups')

    def __str__(self):
        return self.name


class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    student_groups = models.ManyToManyField(StudentGroup, blank=True, related_name='assignments')
    allowed_extensions = models.CharField(
        max_length=100,
        help_text="Список разрешённых расширений, разделённых запятыми (например, pdf,docx)",
    )
    open_time = models.DateTimeField()
    close_time = models.DateTimeField()
    files = models.FileField(upload_to='assignments/', blank=True, null=True)

    def __str__(self):
        return self.title


class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    file = models.FileField(upload_to='submissions/', blank=True, null=True)
    text_response = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    verification_payload = models.TextField(blank=True)
    verification_signature = models.CharField(max_length=128, blank=True)
    admin_note = models.TextField(blank=True)
    admin_flags = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.student.username} - {self.assignment.title}"


class Comment(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='submission_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username}: {self.text[:50]}"


class AssignmentEvent(models.Model):
    EVENT_TYPES = [
        ('OPEN_PAGE', 'Открыл страницу'),
        ('START_WORK', 'Начал работу'),
    ]
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='assignment_events')
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['student', 'assignment'])]
        ordering = ['created_at']

    def __str__(self):
        return f"{self.student.username} / {self.assignment.title} / {self.event_type}"


class LoginLog(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='login_logs')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class SiteSettings(models.Model):
    """Singleton: одна запись с настройками логики сайта (id=1)."""
    registration_open = models.BooleanField(
        default=True,
        verbose_name='Регистрация открыта',
        help_text='При выключении регистрация через API недоступна; новых пользователей добавляет только админ, активация вручную.',
    )

    class Meta:
        verbose_name = 'Настройки сайта'
        verbose_name_plural = 'Настройки сайта'

    def __str__(self):
        return 'Настройки сайта'


def get_site_settings():
    """Возвращает единственный экземпляр настроек (singleton)."""
    settings_obj, _ = SiteSettings.objects.get_or_create(
        id=1,
        defaults={'registration_open': True},
    )
    return settings_obj
