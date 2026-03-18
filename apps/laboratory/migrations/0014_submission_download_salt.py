import secrets

from django.db import migrations, models


def populate_download_salt(apps, schema_editor):
    Submission = apps.get_model('laboratory', 'Submission')
    # Existing rows may have default '' — fill them with random salts.
    qs = Submission.objects.all()
    for sub in qs.iterator():
        if not getattr(sub, 'download_salt', ''):
            sub.download_salt = secrets.token_hex(32)  # 64 hex chars
            sub.save(update_fields=['download_salt'])


class Migration(migrations.Migration):
    dependencies = [
        ('laboratory', '0013_submission_uuid'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='download_salt',
            field=models.CharField(max_length=64, blank=True, default='', db_index=True),
        ),
        migrations.RunPython(populate_download_salt, migrations.RunPython.noop),
    ]

