from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0008_add_session_key'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='customuser',
            name='session_key',
        ),
    ]
