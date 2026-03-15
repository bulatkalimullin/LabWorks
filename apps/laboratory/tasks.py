import zipfile
from io import BytesIO

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .models import Assignment, Submission


@shared_task
def build_assignment_zip_async(assignment_id: str) -> str:
    """
    Build ZIP for assignment submissions; returns path or storage key if saved to storage.
    For sync download, API can still build zip inline; this task is for heavy exports.
    """
    assignment = Assignment.objects.get(pk=assignment_id)
    submissions = Submission.objects.filter(assignment=assignment)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for submission in submissions:
            student_groups = submission.student.student_groups.filter(assignments=assignment)
            group_name = student_groups.first().name if student_groups.exists() else 'NoGroup'
            student_name = submission.student.full_name.replace('/', '_').replace('\\', '_')
            if submission.file:
                base_name = submission.file.name.split('/')[-1]
                arcname = f'{group_name}/{student_name}/{base_name}'
                try:
                    with submission.file.open('rb') as f:
                        zf.writestr(arcname, f.read())
                except Exception:
                    pass
            if submission.text_response:
                text_path = f'{group_name}/{student_name}/{submission.student.username}_text_response.txt'
                zf.writestr(text_path, submission.text_response)
    buffer.seek(0)
    key = f'exports/{assignment_id}_submissions.zip'
    default_storage.save(key, ContentFile(buffer.read()))
    return key
