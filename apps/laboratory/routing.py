from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path('ws/assignments/', consumers.AssignmentConsumer.as_asgi()),
]
