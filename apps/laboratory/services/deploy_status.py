from __future__ import annotations

from typing import Any

from django.conf import settings

from django.utils import timezone

from apps.laboratory.deploy_phases import deploy_phase_message
from apps.laboratory.models import StudentDeployment


def checker_public_url() -> str:
    return getattr(settings, 'CHECKER_PUBLIC_URL', 'https://checker.webflare.ru').rstrip('/')


def _snapshot_value(snapshot: dict[str, Any], key: str, default: Any = None) -> Any:
    value = snapshot.get(key, default)
    return default if value is None else value


def build_deployment_api_payload(deployment: StudentDeployment) -> dict[str, Any]:
    student = deployment.student
    snapshot = deployment.deploy_snapshot or {}
    phase = deployment.status
    label = _snapshot_value(snapshot, 'label') or deploy_phase_message(phase)
    legacy_status = {
        'queued': 'pending',
        'downloading': 'pending',
        'deploying': 'pending',
        'ready_to_test': 'running',
        'error': 'error',
    }.get(phase, 'pending')

    public_urls = deployment.access_urls or []
    url = deployment.deploy_url or _snapshot_value(snapshot, 'url')
    links = _snapshot_value(snapshot, 'links') or {}
    if not links:
        submission_uuid = deployment.last_submission_uuid
        links = {
            'docs': f'{checker_public_url()}/docs/',
            'status_api': f'{checker_public_url()}/api/deploy/status/',
        }
        if submission_uuid:
            links['panel'] = (
                f'{checker_public_url()}/deploy/panel/'
                f'?submission_uuid={submission_uuid}&embed=1'
            )

    return {
        'student_id': student.id,
        'student_username': student.username,
        'phase': phase,
        'status': legacy_status,
        'label': label,
        'status_label': label,
        'hint': _snapshot_value(snapshot, 'hint', ''),
        'progress': _snapshot_value(snapshot, 'progress'),
        'message': _snapshot_value(snapshot, 'message') or label,
        'url': url or None,
        'access_urls': public_urls,
        'public_urls': public_urls,
        'error': _snapshot_value(snapshot, 'error'),
        'links': links,
        'steps': _snapshot_value(snapshot, 'steps') or [],
        'messages': _snapshot_value(snapshot, 'messages') or [],
        'last_submission_uuid': str(deployment.last_submission_uuid) if deployment.last_submission_uuid else None,
        'submission_uuid': str(deployment.last_submission_uuid) if deployment.last_submission_uuid else None,
        'checker_project_id': deployment.checker_project_id,
        'public_base_url': deployment.public_base_url or '',
        'updated_at': deployment.updated_at.isoformat() if deployment.updated_at else None,
        'traceback': deployment.traceback or '',
    }


def _user_facing_error(data: dict[str, Any]) -> str:
    summary = (data.get('error_summary') or '').strip()
    if summary:
        return summary[:500]
    err = (data.get('error') or '').strip()
    if not err:
        return ''
    if len(err) > 500 or 'HTTPConnectionPool' in err or 'Traceback' in err:
        return 'Не удалось опубликовать проект на тестовом стенде'
    return err[:500]


def _append_deploy_messages(existing: list, data: dict[str, Any]) -> list:
    messages = list(existing or [])
    seen = {m.get('text') for m in messages if isinstance(m, dict) and m.get('text')}
    phase = data.get('phase') or data.get('status')
    at = data.get('updated_at') or timezone.now().isoformat()

    for field, kind in (('label', 'status'), ('hint', 'hint'), ('message', 'status')):
        text = data.get(field)
        if not text:
            continue
        text = str(text).strip()
        if not text or text in seen:
            continue
        messages.append({'text': text, 'phase': phase, 'kind': kind, 'at': at})
        seen.add(text)

    err = _user_facing_error(data)
    if err and err not in seen:
        messages.append({'text': err, 'phase': 'error', 'kind': 'error', 'at': at})

    return messages[-40:]


def apply_checker_payload_to_deployment(deployment: StudentDeployment, data: dict[str, Any]) -> None:
    from apps.laboratory.deploy_phases import normalize_deploy_phase

    raw_phase = data.get('phase') or data.get('status', 'error')
    deployment.status = normalize_deploy_phase(raw_phase)
    deployment.access_urls = data.get('public_urls') or data.get('access_urls') or []
    deployment.deploy_url = data.get('url') or ''
    deployment.public_base_url = data.get('public_base_url') or deployment.public_base_url or ''
    if data.get('submission_uuid'):
        deployment.last_submission_uuid = data['submission_uuid']
    deployment.checker_project_id = data.get('checker_project_id')

    user_error = _user_facing_error(data)
    prev_snapshot = deployment.deploy_snapshot or {}
    deployment.deploy_snapshot = {
        key: data[key]
        for key in ('label', 'hint', 'progress', 'message', 'url', 'links', 'steps')
        if data.get(key) is not None
    }
    deployment.deploy_snapshot['messages'] = _append_deploy_messages(
        prev_snapshot.get('messages') or data.get('messages'),
        data,
    )
    if user_error:
        deployment.deploy_snapshot['error'] = user_error
