import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.laboratory.jwt import LabworksAccessToken, assert_session_active
from apps.laboratory.models import CustomUser
from apps.laboratory.services.realtime import (
    STAFF_WS_GROUP,
    get_assignments_snapshot_for_user,
    get_deployment_snapshot_for_user,
)


@database_sync_to_async
def get_user_from_jwt(token_value):
    if not token_value:
        return None
    try:
        access = LabworksAccessToken(token_value)
        assert_session_active(access)
        return CustomUser.objects.get(pk=access['user_id'])
    except (InvalidToken, TokenError, CustomUser.DoesNotExist, KeyError):
        return None


@database_sync_to_async
def get_snapshot(user):
    return get_assignments_snapshot_for_user(user)


@database_sync_to_async
def get_deployment_snapshot(user):
    return get_deployment_snapshot_for_user(user)


class AssignmentConsumer(AsyncWebsocketConsumer):
    """WebSocket: assignment + deployment updates for students and staff."""

    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=', 1) for p in query_string.split('&') if '=' in p)
        token = params.get('token') or params.get('access')
        self.scope['user'] = await get_user_from_jwt(token)
        user = self.scope['user']
        if not user:
            await self.close(code=4001)
            return

        if user.is_staff:
            self.group_name = STAFF_WS_GROUP
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            return

        self.user_id = user.id
        self.group_name = f'assignment_user_{self.user_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        snapshot = await get_snapshot(user)
        await self.send(text_data=json.dumps({
            'type': 'assignments_snapshot',
            'payload': snapshot,
        }))

        deployment = await get_deployment_snapshot(user)
        if deployment:
            await self.send(text_data=json.dumps({
                'type': 'deployment_snapshot',
                'payload': deployment,
            }))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def assignment_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'assignment_updated',
            'assignment_id': event.get('assignment_id'),
            'changed_fields': event.get('changed_fields', []),
            'payload': event.get('payload', {}),
        }))

    async def deployment_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'deployment_updated',
            'payload': event.get('payload', {}),
        }))
