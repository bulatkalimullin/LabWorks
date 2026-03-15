import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0004_courseimage'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='label',
            field=models.CharField(
                blank=True,
                choices=[
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
                ],
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='submission',
            name='admin_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='submission',
            name='admin_flags',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name='AssignmentEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(
                    choices=[('OPEN_PAGE', 'Открыл страницу'), ('START_WORK', 'Начал работу')],
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('assignment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='events',
                    to='laboratory.assignment',
                )),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='assignment_events',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['student', 'assignment'], name='laboratory__student_8a6a7e_idx'),
                ],
            },
        ),
    ]
