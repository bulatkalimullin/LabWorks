from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from apps.laboratory.models import Assignment, CustomUser, DeadlineOverride
from apps.laboratory.services.deadline import get_affected_user_ids, get_affected_user_ids_for_override, get_effective_close_time

logger = logging.getLogger(__name__)

FIELD_LABELS = {
    'title': 'название',
    'description': 'описание',
    'open_time': 'время открытия',
    'close_time': 'время закрытия',
    'allowed_extensions': 'допустимые форматы',
    'files': 'файл задания',
    'effective_close_time': 'ваш дедлайн',
}

ASSIGNMENT_TRACKED_FIELDS = (
    'title', 'description', 'open_time', 'close_time',
    'allowed_extensions', 'files',
)


def build_assignment_payload(assignment: Assignment, user: CustomUser | None) -> dict[str, Any]:
    effective_close = get_effective_close_time(assignment, user)
    files_name = assignment.files.name if assignment.files else None
    return {
        'id': str(assignment.id),
        'title': assignment.title,
        'description': assignment.description,
        'course': assignment.course_id,
        'course_id': assignment.course_id,
        'allowed_extensions': assignment.allowed_extensions,
        'open_time': assignment.open_time.isoformat(),
        'close_time': assignment.close_time.isoformat(),
        'effective_close_time': effective_close.isoformat(),
        'files': files_name,
        'file_url': f'/api/v1/assignments/{assignment.id}/download-file/' if assignment.files else None,
    }


def diff_assignment_fields(old: Assignment | None, new: Assignment) -> list[str]:
    if old is None:
        return list(ASSIGNMENT_TRACKED_FIELDS)
    changed = []
    for field in ASSIGNMENT_TRACKED_FIELDS:
        old_val = getattr(old, field, None)
        new_val = getattr(new, field, None)
        if old_val != new_val:
            changed.append(field)
    return changed


def _user_channel(user_id: int) -> str:
    return f'assignment_user_{user_id}'


def broadcast_assignment_update(
    assignment: Assignment,
    changed_fields: list[str],
    *,
    user_ids: set[int] | None = None,
) -> None:
    if not changed_fields:
        return
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning('No channel layer configured; skipping assignment broadcast')
        return

    targets = user_ids if user_ids is not None else get_affected_user_ids(assignment)
    for user_id in targets:
        try:
            user = CustomUser.objects.get(pk=user_id, is_staff=False)
        except CustomUser.DoesNotExist:
            continue
        payload = build_assignment_payload(assignment, user)
        fields = list(changed_fields)
        if 'close_time' in fields and 'effective_close_time' not in fields:
            fields.append('effective_close_time')
        event = {
            'type': 'assignment_updated',
            'assignment_id': str(assignment.id),
            'changed_fields': fields,
            'payload': payload,
        }
        async_to_sync(channel_layer.group_send)(_user_channel(user_id), event)


def broadcast_override_update(override: DeadlineOverride, *, deleted: bool = False) -> None:
    assignment = override.assignment
    user_ids = get_affected_user_ids_for_override(override)
    changed_fields = ['effective_close_time']
    if deleted:
        changed_fields.append('close_time')
    broadcast_assignment_update(assignment, changed_fields, user_ids=user_ids)


def get_assignments_snapshot_for_user(user: CustomUser) -> list[dict[str, Any]]:
    now = timezone.now()
    user_groups = user.student_groups.all()
    assignments = (
        Assignment.objects.filter(student_groups__in=user_groups)
        .select_related('course')
        .distinct()
    )
    result = []
    for assignment in assignments:
        effective_close = get_effective_close_time(assignment, user)
        if assignment.open_time <= now <= effective_close:
            result.append(build_assignment_payload(assignment, user))
    return result
