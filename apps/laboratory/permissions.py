from rest_framework import permissions


class IsTeacher(permissions.BasePermission):
    """Staff-only access (teacher panel, create, export)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsStudentInAssignmentGroup(permissions.BasePermission):
    """
    Student must be in one of the assignment's student_groups and within open/close time.
    Staff bypasses.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        from django.utils import timezone
        now = timezone.now()
        assignment = obj if hasattr(obj, 'open_time') else getattr(obj, 'assignment', None)
        if assignment is None:
            return False
        from apps.laboratory.services.deadline import get_effective_close_time
        effective_close = get_effective_close_time(assignment, request.user)
        if not (assignment.open_time <= now <= effective_close):
            return False
        user_groups = request.user.student_groups.all()
        return assignment.student_groups.filter(pk__in=user_groups).exists()
