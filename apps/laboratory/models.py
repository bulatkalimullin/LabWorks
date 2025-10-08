
from django.db import models
from django.contrib.auth.models import AbstractUser, Group as AuthGroup

class CustomUser(AbstractUser):
    full_name = models.CharField(max_length=255)
    student_groups = models.ManyToManyField('StudentGroup', blank=True, related_name='students')
    groups = models.ManyToManyField(AuthGroup, blank=True, related_name='user_set')

    def __str__(self):
        return self.username

class Course(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class StudentGroup(models.Model):
    name = models.CharField(max_length=100)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='student_groups')

    def __str__(self):
        return self.name

class Assignment(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    student_groups = models.ManyToManyField(StudentGroup, blank=True, related_name='assignments')
    allowed_extensions = models.CharField(max_length=100, help_text="Список разрешённых расширений, разделённых запятыми (например, pdf,docx)")
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

    def __str__(self):
        return f"{self.student.username} - {self.assignment.title}"
