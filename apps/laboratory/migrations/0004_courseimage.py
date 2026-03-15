import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratory', '0003_submission_verification'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='course_images/')),
                ('title', models.CharField(blank=True, max_length=255)),
                ('order', models.PositiveIntegerField(default=0)),
                ('course', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='images',
                    to='laboratory.course',
                )),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
    ]
