import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0014_submission_download_salt'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeadlineOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('close_time', models.DateTimeField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assignment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deadline_overrides', to='laboratory.assignment')),
                ('student_group', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='deadline_overrides', to='laboratory.studentgroup')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='deadline_overrides', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name='deadlineoverride',
            constraint=models.CheckConstraint(
                check=models.Q(('user__isnull', False), ('student_group__isnull', True))
                | models.Q(('user__isnull', True), ('student_group__isnull', False)),
                name='deadline_override_user_xor_group',
            ),
        ),
        migrations.AddConstraint(
            model_name='deadlineoverride',
            constraint=models.UniqueConstraint(
                condition=models.Q(('user__isnull', False)),
                fields=('assignment', 'user'),
                name='deadline_override_unique_assignment_user',
            ),
        ),
        migrations.AddConstraint(
            model_name='deadlineoverride',
            constraint=models.UniqueConstraint(
                condition=models.Q(('student_group__isnull', False)),
                fields=('assignment', 'student_group'),
                name='deadline_override_unique_assignment_group',
            ),
        ),
    ]
