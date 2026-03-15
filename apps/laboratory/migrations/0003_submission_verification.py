from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0002_comment_totp'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='verification_payload',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='submission',
            name='verification_signature',
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
