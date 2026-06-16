DEPLOY_PHASE_QUEUED = 'queued'
DEPLOY_PHASE_DOWNLOADING = 'downloading'
DEPLOY_PHASE_DEPLOYING = 'deploying'
DEPLOY_PHASE_READY = 'ready_to_test'
DEPLOY_PHASE_ERROR = 'error'

DEPLOY_PHASE_MESSAGES = {
    DEPLOY_PHASE_QUEUED: 'В очереди',
    DEPLOY_PHASE_DOWNLOADING: 'Скачивание архива',
    DEPLOY_PHASE_DEPLOYING: 'Деплоится',
    DEPLOY_PHASE_READY: 'Готово к тестированию',
    DEPLOY_PHASE_ERROR: 'Ошибка',
}

DEPLOY_PHASE_CHOICES = tuple(DEPLOY_PHASE_MESSAGES.items())

DEPLOY_IN_PROGRESS = frozenset({
    DEPLOY_PHASE_QUEUED,
    DEPLOY_PHASE_DOWNLOADING,
    DEPLOY_PHASE_DEPLOYING,
})

_LEGACY_PHASE_MAP = {
    'pending': DEPLOY_PHASE_QUEUED,
    'running': DEPLOY_PHASE_READY,
}


def normalize_deploy_phase(raw: str | None) -> str:
    if not raw:
        return DEPLOY_PHASE_ERROR
    value = str(raw).strip()
    if value in DEPLOY_PHASE_MESSAGES:
        return value
    return _LEGACY_PHASE_MAP.get(value, DEPLOY_PHASE_ERROR)


def deploy_phase_message(phase: str) -> str:
    return DEPLOY_PHASE_MESSAGES.get(phase, phase)
