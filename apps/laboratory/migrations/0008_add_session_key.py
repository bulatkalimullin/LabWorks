from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0007_loginlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='session_key',
            field=models.CharField(blank=True, default='', max_length=36),
        ),
    ]
