from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0018_deploy_phases'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentdeployment',
            name='deploy_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='studentdeployment',
            name='deploy_url',
            field=models.URLField(blank=True, default='', max_length=512),
        ),
    ]
