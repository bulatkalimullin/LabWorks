from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone

from apps.laboratory.models import Assignment, CustomUser, DeadlineOverride, StudentGroup


def get_user_override_close_time(assignment: Assignment, user: CustomUser) -> datetime | None:
    override = (
        DeadlineOverride.objects.filter(assignment=assignment, user=user)
        .values_list('close_time', flat=True)
        .first()
    )
    return override


def get_group_override_close_time(assignment: Assignment, user: CustomUser) -> datetime | None:
    user_group_ids = list(user.student_groups.values_list('pk', flat=True))
    if not user_group_ids:
        return None
    overrides = DeadlineOverride.objects.filter(
        assignment=assignment,
        student_group_id__in=user_group_ids,
    ).values_list('close_time', flat=True)
    if not overrides:
        return None
    return max(overrides)


def get_effective_close_time(assignment: Assignment, user: CustomUser | None) -> datetime:
    """Individual override > group override (latest) > assignment.close_time."""
    if user is None or getattr(user, 'is_staff', False):
        return assignment.close_time
    user_override = get_user_override_close_time(assignment, user)
    if user_override is not None:
        return user_override
    group_override = get_group_override_close_time(assignment, user)
    if group_override is not None:
        return group_override
    return assignment.close_time


def is_assignment_open_for_user(assignment: Assignment, user: CustomUser) -> bool:
    now = timezone.now()
    effective_close = get_effective_close_time(assignment, user)
    return assignment.open_time <= now <= effective_close


def get_affected_user_ids(assignment: Assignment) -> set[int]:
    group_ids = assignment.student_groups.values_list('pk', flat=True)
    return set(
        CustomUser.objects.filter(
            is_staff=False,
            student_groups__in=group_ids,
        ).values_list('pk', flat=True).distinct()
    )


def resolve_override_close_time(
    assignment: Assignment,
    *,
    user: CustomUser | None = None,
    student_group: StudentGroup | None = None,
    close_time: datetime | None = None,
    add_minutes: int | None = None,
) -> datetime:
    """Absolute close_time or extend current effective deadline by add_minutes."""
    if add_minutes is not None:
        add_minutes = max(0, int(add_minutes))
        if user is not None:
            base = get_effective_close_time(assignment, user)
        elif student_group is not None:
            existing = DeadlineOverride.objects.filter(
                assignment=assignment,
                student_group=student_group,
            ).first()
            base = existing.close_time if existing else assignment.close_time
        else:
            base = assignment.close_time
        now = timezone.now()
        base = max(base, now)
        return base + timedelta(minutes=add_minutes)
    if close_time is None:
        raise ValueError('close_time or add_minutes is required')
    return close_time


def get_affected_user_ids_for_override(override: DeadlineOverride) -> set[int]:
    if override.user_id:
        return {override.user_id}
    if override.student_group_id:
        return set(
            CustomUser.objects.filter(
                is_staff=False,
                student_groups=override.student_group_id,
            ).values_list('pk', flat=True)
        )
    return get_affected_user_ids(override.assignment)
