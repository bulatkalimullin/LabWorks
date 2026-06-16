import type { DeploymentInfo } from '../components/DeploymentStatus'

export type DeployStep = {
  phase: string
  label: string
  done: boolean
  active: boolean
}

export type DeployLinks = {
  docs?: string
  panel?: string
  status_api?: string
}

export type DeployFeedMessage = {
  text: string
  phase?: string
  kind?: 'status' | 'hint' | 'error' | 'success'
  at?: string
}

export type CheckerDeployStatus = {
  submission_uuid?: string
  student_id?: number
  phase?: string
  status?: string
  label?: string
  hint?: string
  progress?: number
  message?: string
  url?: string | null
  public_urls?: DeploymentInfo['access_urls']
  access_urls?: DeploymentInfo['access_urls']
  error?: string | null
  links?: DeployLinks
  steps?: DeployStep[]
  messages?: DeployFeedMessage[]
  updated_at?: string
  checker_project_id?: number | null
  last_submission_uuid?: string | null
  status_label?: string
  traceback?: string
}

const IN_PROGRESS_PHASES = new Set(['queued', 'downloading', 'deploying', 'pending'])

const DEFAULT_STEPS: DeployStep[] = [
  { phase: 'queued', label: 'Подготовка', done: false, active: true },
  { phase: 'downloading', label: 'Загрузка проекта', done: false, active: false },
  { phase: 'deploying', label: 'Развёртывание', done: false, active: false },
  { phase: 'ready_to_test', label: 'Готово', done: false, active: false },
]

const PHASE_PROGRESS: Record<string, number> = {
  queued: 12,
  pending: 12,
  downloading: 38,
  deploying: 72,
  ready_to_test: 100,
  running: 100,
  error: 100,
}

function resolvePhase(raw: CheckerDeployStatus): string {
  if (raw.phase) return raw.phase
  if (raw.status === 'running') return 'ready_to_test'
  if (raw.status === 'pending') return 'queued'
  if (raw.status === 'error') return 'error'
  return raw.status || 'queued'
}

export function sanitizeDeployError(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (
    trimmed.includes('HTTPConnectionPool')
    || trimmed.includes('Traceback')
    || trimmed.includes('Connection refused')
    || trimmed.includes('NewConnectionError')
  ) {
    const line = trimmed
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('File ') && !l.startsWith('raise '))
    if (line && line.length <= 180) return line
    return 'Не удалось опубликовать проект на тестовом стенде'
  }

  if (trimmed.length > 280) return `${trimmed.slice(0, 277)}…`
  return trimmed
}

export function normalizeDeploymentInfo(raw: CheckerDeployStatus | DeploymentInfo): DeploymentInfo {
  const checker = raw as CheckerDeployStatus
  const phase = resolvePhase(checker)
  const access_urls = checker.public_urls ?? raw.access_urls ?? []
  const label = raw.label ?? raw.status_label
  const links = raw.links

  return {
    status: phase,
    phase,
    label,
    status_label: label,
    hint: raw.hint,
    progress: typeof raw.progress === 'number' ? raw.progress : PHASE_PROGRESS[phase],
    url: raw.url ?? null,
    access_urls,
    error: raw.error ? sanitizeDeployError(String(raw.error)) : null,
    links,
    steps: raw.steps?.length ? raw.steps : undefined,
    messages: raw.messages?.length ? raw.messages : undefined,
    last_submission_uuid: raw.last_submission_uuid ?? checker.submission_uuid ?? null,
    updated_at: raw.updated_at,
    checker_project_id: raw.checker_project_id,
    traceback: raw.traceback,
  }
}

export function deploymentDocsUrl(deployment?: DeploymentInfo | null): string {
  return (
    deployment?.links?.docs ||
    (import.meta.env.VITE_DEPLOY_DOCS_URL as string | undefined) ||
    'https://checker.webflare.ru/docs/'
  )
}

export function isDeploymentInProgress(deployment?: DeploymentInfo | null): boolean {
  if (!deployment) return false
  const phase = deployment.phase ?? deployment.status
  return IN_PROGRESS_PHASES.has(phase)
}

export function deploymentMatchesSubmission(
  deployment: DeploymentInfo,
  submissionUuid?: string | null,
) {
  if (!deployment.last_submission_uuid || !submissionUuid) return true
  return deployment.last_submission_uuid === submissionUuid
}

export function mergeDeploymentInfo(
  primary: DeploymentInfo | null | undefined,
  secondary: DeploymentInfo | null | undefined,
): DeploymentInfo | null {
  if (!primary) return secondary ?? null
  if (!secondary) return primary

  const primaryTime = primary.updated_at ? Date.parse(primary.updated_at) : 0
  const secondaryTime = secondary.updated_at ? Date.parse(secondary.updated_at) : 0
  const newer = secondaryTime >= primaryTime ? secondary : primary
  const older = newer === secondary ? primary : secondary

  return normalizeDeploymentInfo({
    ...older,
    ...newer,
    access_urls: newer.access_urls?.length ? newer.access_urls : older.access_urls,
    steps: newer.steps?.length ? newer.steps : older.steps,
    messages: (newer.messages?.length ? newer.messages : older.messages),
    links: { ...older.links, ...newer.links },
  })
}

export function buildFallbackSteps(deployment: DeploymentInfo): DeployStep[] {
  if (deployment.steps?.length) return deployment.steps

  const phase = deployment.phase ?? deployment.status
  const order = ['queued', 'downloading', 'deploying', 'ready_to_test']
  const activeIndex = phase === 'error'
    ? order.indexOf('deploying')
    : phase === 'ready_to_test' || phase === 'running'
      ? order.length
      : Math.max(0, order.indexOf(phase))

  return DEFAULT_STEPS.map((step, index) => {
    const done = phase === 'ready_to_test' || phase === 'running'
      ? true
      : index < activeIndex
    const active = phase === 'error'
      ? index === activeIndex
      : phase !== 'ready_to_test' && phase !== 'running' && index === activeIndex
    return { ...step, done, active }
  })
}

export function checkerPanelEmbedUrl(submissionUuid: string): string {
  const checker =
    (import.meta.env.VITE_CHECKER_PUBLIC_URL as string | undefined) ||
    'https://checker.webflare.ru'
  return `${checker.replace(/\/$/, '')}/deploy/panel/?submission_uuid=${encodeURIComponent(submissionUuid)}&embed=1`
}
