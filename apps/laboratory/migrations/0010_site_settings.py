from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0009_remove_customuser_session_key'),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('registration_open', models.BooleanField(default=True, help_text='При выключении регистрация через API недоступна; новых пользователей добавляет только админ, активация вручную.', verbose_name='Регистрация открыта')),
            ],
            options={
                'verbose_name': 'Настройки сайта',
                'verbose_name_plural': 'Настройки сайта',
            },
        ),
    ]
