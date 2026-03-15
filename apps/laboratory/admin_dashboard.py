from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Count
from django.shortcuts import render
from django.utils import timezone

from .models import CustomUser, Course, Assignment, Submission, AssignmentEvent, STUDENT_LABELS


@staff_member_required
def admin_dashboard_view(request):
    now = timezone.now()
    thirty_days_ago = now - timezone.timedelta(days=30)

    total_students = CustomUser.objects.filter(is_staff=False).count()
    total_courses = Course.objects.count()
    total_assignments = Assignment.objects.count()
    total_submissions = Submission.objects.count()
    recent_submissions = Submission.objects.filter(submitted_at__gte=thirty_days_ago).count()

    # Submissions per day — last 14 days
    subs_by_day = []
    for i in range(13, -1, -1):
        day = now - timezone.timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
        count = Submission.objects.filter(
            submitted_at__gte=day_start, submitted_at__lte=day_end
        ).count()
        subs_by_day.append({"date": day_start.strftime("%d.%m"), "count": count})

    max_daily = max((d["count"] for d in subs_by_day), default=1) or 1

    # Label distribution
    label_dict = dict(STUDENT_LABELS)
    label_distribution = []
    for code, name in STUDENT_LABELS:
        if code:
            c = CustomUser.objects.filter(label=code, is_staff=False).count()
            if c > 0:
                label_distribution.append({"code": code, "name": name, "count": c})
    label_distribution.sort(key=lambda x: x["count"], reverse=True)

    # Top assignments by submissions
    top_assignments = (
        Assignment.objects.annotate(sub_count=Count("submissions"))
        .order_by("-sub_count")[:8]
    )

    # Recent submissions
    latest_submissions = (
        Submission.objects.select_related("student", "assignment__course")
        .order_by("-submitted_at")[:15]
    )

    context = {
        "title": "Дашборд",
        "total_students": total_students,
        "total_courses": total_courses,
        "total_assignments": total_assignments,
        "total_submissions": total_submissions,
        "recent_submissions": recent_submissions,
        "subs_by_day": subs_by_day,
        "max_daily": max_daily,
        "label_distribution": label_distribution,
        "top_assignments": top_assignments,
        "latest_submissions": latest_submissions,
    }
    return render(request, "admin/dashboard.html", context)
