
from django import template

register = template.Library()

@register.filter
def intersection(queryset1, queryset2):
    return queryset1.filter(pk__in=queryset2.values('pk'))
