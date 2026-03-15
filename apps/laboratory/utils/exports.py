"""Safe ZIP export helpers for submission downloads."""
import zipfile
from io import BytesIO
from pathlib import PurePosixPath


def _safe_name(name: str) -> str:
    return name.replace('/', '_').replace('\\', '_').replace(':', '_').strip() or 'unnamed'


BLOCKED_DIRS = {
    'venv', '.venv', 'env', '.env', 'node_modules', '.git',
    '__pycache__', '.mypy_cache', '.pytest_cache', '.tox',
    'dist', 'build', '.eggs', '*.egg-info',
}


def _is_blocked_path(arcname: str) -> bool:
    """Return True if any component of arcname is a blocked directory."""
    parts = PurePosixPath(arcname).parts
    for part in parts:
        clean = part.rstrip('/')
        if clean in BLOCKED_DIRS:
            return True
        if clean.endswith('.egg-info'):
            return True
    return False


def build_zip_by_groups(submissions, fixed_group_name=None, include_assignment_in_path=True) -> BytesIO:
    """
    Build a ZIP with structure: GroupName/StudentName/file.
    If fixed_group_name is set (e.g. when exporting one group), use it for all.
    Otherwise derive group from student.student_groups & assignment.student_groups.
    If include_assignment_in_path, add assignment title to path to avoid collisions: Group/Student/AssignmentTitle_file.
    """
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for submission in submissions:
            if fixed_group_name is not None:
                group_name = _safe_name(fixed_group_name)
            else:
                student_groups = submission.student.student_groups.filter(assignments=submission.assignment)
                first_group = student_groups.first()
                group_name = _safe_name(first_group.name) if first_group else 'NoGroup'
            student_name = _safe_name(submission.student.full_name) or submission.student.username
            assignment_slug = _safe_name(submission.assignment.title) if include_assignment_in_path else ''
            prefix = f"{group_name}/{student_name}"
            if assignment_slug:
                prefix = f"{prefix}/{assignment_slug}"

            if submission.file:
                try:
                    base_name = submission.file.name.split('/')[-1]
                    arcname = f"{prefix}/{base_name}"
                    with submission.file.open('rb') as f:
                        zf.writestr(arcname, f.read())
                except Exception:
                    pass
            if submission.text_response and submission.text_response.strip():
                zf.writestr(f"{prefix}/response.txt", submission.text_response)
    buffer.seek(0)
    return buffer


def build_smart_zip(submissions) -> BytesIO:
    """
    Build a ZIP archive with structure:
        GroupName/StudentName/project/<unpacked files>  — if submission is a ZIP
        GroupName/StudentName/submission.<ext>           — otherwise
        GroupName/StudentName/response.txt               — if text_response exists

    Blocked directories (venv, node_modules, .git, …) are excluded when
    extracting ZIP submissions.
    """
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as out_zf:
        for submission in submissions:
            student = submission.student
            student_groups = student.student_groups.filter(assignments=submission.assignment)
            first_group = student_groups.first()
            group_name = _safe_name(first_group.name) if first_group else 'NoGroup'
            student_folder = f"{_safe_name(student.full_name)} ({student.username})"
            folder = f"{group_name}/{student_folder}"

            if submission.file:
                try:
                    with submission.file.open('rb') as f:
                        raw = f.read()
                except Exception:
                    raw = None

                if raw:
                    ext = submission.file.name.rsplit('.', 1)[-1].lower() if '.' in submission.file.name else ''
                    if ext == 'zip':
                        try:
                            inner_buffer = BytesIO(raw)
                            with zipfile.ZipFile(inner_buffer, 'r') as in_zf:
                                for member in in_zf.infolist():
                                    if member.is_dir():
                                        continue
                                    if _is_blocked_path(member.filename):
                                        continue
                                    member_data = in_zf.read(member.filename)
                                    arcname = f"{folder}/project/{member.filename}"
                                    out_zf.writestr(arcname, member_data)
                        except Exception:
                            # Fallback: add the zip as-is
                            out_zf.writestr(f"{folder}/submission.zip", raw)
                    else:
                        base = submission.file.name.rsplit('/', 1)[-1]
                        out_zf.writestr(f"{folder}/{base}", raw)

            if submission.text_response and submission.text_response.strip():
                out_zf.writestr(f"{folder}/response.txt", submission.text_response)

    buffer.seek(0)
    return buffer
