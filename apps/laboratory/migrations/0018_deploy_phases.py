from django.db import migrations, models


def migrate_legacy_phases(apps, schema_editor):
    StudentDeployment = apps.get_model('laboratory', 'StudentDeployment')
    mapping = {
        'pending': 'queued',
        'running': 'ready_to_test',
    }
    for old, new in mapping.items():
        StudentDeployment.objects.filter(status=old).update(status=new)


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0017_deploy_integration'),
    ]

    operations = [
        migrations.AlterField(
            model_name='studentdeployment',
            name='status',
            field=models.CharField(
                choices=[
                    ('queued', 'В очереди'),
                    ('downloading', 'Скачивание архива'),
                    ('deploying', 'Деплоится'),
                    ('ready_to_test', 'Готово к тестированию'),
                    ('error', 'Ошибка'),
                ],
                default='queued',
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_legacy_phases, migrations.RunPython.noop),
    ]
