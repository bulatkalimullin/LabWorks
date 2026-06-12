from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.laboratory.models import Assignment, DeadlineOverride
from apps.laboratory.services.realtime import (
    ASSIGNMENT_TRACKED_FIELDS,
    broadcast_assignment_update,
    broadcast_override_update,
    diff_assignment_fields,
)

_assignment_pre_save_cache: dict = {}


@receiver(pre_save, sender=Assignment)
def assignment_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            _assignment_pre_save_cache[instance.pk] = Assignment.objects.get(pk=instance.pk)
        except Assignment.DoesNotExist:
            pass


@receiver(post_save, sender=Assignment)
def assignment_post_save(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created:
        broadcast_assignment_update(instance, list(ASSIGNMENT_TRACKED_FIELDS))
        return
    old = _assignment_pre_save_cache.pop(instance.pk, None)
    changed = diff_assignment_fields(old, instance)
    if changed:
        broadcast_assignment_update(instance, changed)


@receiver(m2m_changed, sender=Assignment.student_groups.through)
def assignment_groups_changed(sender, instance, action, **kwargs):
    if action in ('post_add', 'post_remove', 'post_clear'):
        broadcast_assignment_update(instance, ['student_groups'])


@receiver(post_save, sender=DeadlineOverride)
def deadline_override_saved(sender, instance, **kwargs):
    broadcast_override_update(instance)


@receiver(post_delete, sender=DeadlineOverride)
def deadline_override_deleted(sender, instance, **kwargs):
    broadcast_override_update(instance, deleted=True)
