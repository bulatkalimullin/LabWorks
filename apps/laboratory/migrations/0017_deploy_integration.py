from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0016_remove_deadlineoverride_deadline_override_user_xor_group_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='auto_deploy',
            field=models.BooleanField(
                default=False,
                help_text='Автоматически разворачивать проект на checker при сдаче архива',
            ),
        ),
        migrations.CreateModel(
            name='StudentDeployment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Ожидание'),
                        ('deploying', 'Развёртывание'),
                        ('running', 'Запущен'),
                        ('error', 'Ошибка'),
                    ],
                    default='pending',
                    max_length=16,
                )),
                ('access_urls', models.JSONField(blank=True, default=list)),
                ('traceback', models.TextField(blank=True, default='')),
                ('public_base_url', models.URLField(blank=True, default='', max_length=512)),
                ('last_submission_uuid', models.UUIDField(blank=True, null=True)),
                ('checker_project_id', models.IntegerField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='deployment',
                    to='laboratory.customuser',
                )),
            ],
        ),
    ]
