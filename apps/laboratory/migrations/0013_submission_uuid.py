import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('laboratory', '0012_keylog_event_type'),
    ]

    def populate_submission_uuids(apps, schema_editor):
        Submission = apps.get_model('laboratory', 'Submission')
        # Generate per-row UUIDs to avoid "one default value for all rows"
        # which can happen when adding a unique field with a default in a migration.
        for sub in Submission.objects.filter(uuid__isnull=True):
            sub.uuid = uuid.uuid4()
            sub.save(update_fields=['uuid'])

    operations = [
        migrations.AddField(
            model_name='submission',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, unique=False, db_index=True),
        ),
        migrations.RunPython(populate_submission_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='submission',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
    ]

