import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import DeployMessageFeed from './DeployMessageFeed'
import {
  buildFallbackSteps,
  isDeploymentInProgress,
} from '../lib/deployStatus'
import { useAnimatedProgress } from '../hooks/useAnimatedProgress'
import type { DeployFeedMessage as StoredDeployMessage } from '../lib/deployStatus'
import { useDeployMessageFeed } from '../hooks/useDeployMessageFeed'

export type PublicUrl = {
  service: string
  container_port?: number
  host_port?: number
  host?: string
  url: string
  direct_url?: string
  domain_url?: string
}

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

export type DeploymentInfo = {
  status: string
  phase?: string
  label?: string
  status_label?: string
  hint?: string
  progress?: number
  message?: string
  url?: string | null
  access_urls: PublicUrl[]
  error?: string | null
  links?: DeployLinks
  steps?: DeployStep[]
  messages?: StoredDeployMessage[]
  traceback?: string
  public_base_url?: string
  last_submission_uuid?: string | null
  updated_at?: string
  checker_project_id?: number | null
}

export { deploymentMatchesSubmission, isDeploymentInProgress } from '../lib/deployStatus'

type Props = {
  deployment: DeploymentInfo
  compact?: boolean
  showProgress?: boolean
  sessionKey?: string | null
}

function displayLabel(deployment: DeploymentInfo): string {
  return deployment.label || deployment.status_label || deployment.message || 'Публикация проекта'
}

function displayProgress(deployment: DeploymentInfo): number {
  if (typeof deployment.progress === 'number') {
    return Math.max(0, Math.min(100, deployment.progress))
  }
  const phase = deployment.phase ?? deployment.status
  const map: Record<string, number> = {
    queued: 12,
    downloading: 38,
    deploying: 72,
    ready_to_test: 100,
    running: 100,
    error: 100,
  }
  return map[phase] ?? 0
}

export default function DeploymentStatus({
  deployment,
  compact = false,
  showProgress = !compact,
  sessionKey,
}: Props) {
  const phase = deployment.phase ?? deployment.status
  const loading = isDeploymentInProgress(deployment)
  const isError = phase === 'error'
  const isSuccess = phase === 'ready_to_test' || phase === 'running'
  const targetProgress = displayProgress(deployment)
  const animatedProgress = useAnimatedProgress(targetProgress, loading ? 1400 : 900)
  const steps = buildFallbackSteps(deployment)
  const feed = useDeployMessageFeed(deployment, sessionKey ?? deployment.last_submission_uuid)
  const projectUrl = deployment.url
  const serviceUrls = deployment.access_urls ?? []
  const progressLabel = Math.round(animatedProgress)

  return (
    <div className={`deploy-status ${compact ? 'deploy-status--compact' : ''}`}>
      <div className="deploy-status__header">
        {loading ? (
          <Loader2 size={16} className="deploy-status__spinner" aria-hidden />
        ) : isSuccess ? (
          <CheckCircle2 size={16} className="deploy-status__icon deploy-status__icon--ok" aria-hidden />
        ) : isError ? (
          <AlertCircle size={16} className="deploy-status__icon deploy-status__icon--err" aria-hidden />
        ) : (
          <Loader2 size={16} className="deploy-status__spinner" aria-hidden />
        )}
        <span className="deploy-status__label">{displayLabel(deployment)}</span>
        {showProgress && (
          <span className="deploy-status__percent" aria-hidden>{progressLabel}%</span>
        )}
      </div>

      {showProgress && (
        <div
          className="deploy-status__progress"
          role="progressbar"
          aria-valuenow={progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Прогресс публикации"
        >
          <div className="deploy-status__progress-track">
            <div
              className={[
                'deploy-status__progress-fill',
                loading ? 'deploy-status__progress-fill--active' : '',
                isError ? 'deploy-status__progress-fill--error' : '',
                isSuccess ? 'deploy-status__progress-fill--success' : '',
              ].filter(Boolean).join(' ')}
              style={{ width: `${animatedProgress}%` }}
            />
            <div
              className="deploy-status__progress-glow"
              style={{ left: `calc(${animatedProgress}% - 6px)` }}
              aria-hidden
            />
          </div>
          <ol className="deploy-status__steps" aria-hidden>
            {steps.map((step) => (
              <li
                key={step.phase}
                className={[
                  'deploy-status__step',
                  step.done ? 'deploy-status__step--done' : '',
                  step.active ? 'deploy-status__step--current' : '',
                  isError && step.active ? 'deploy-status__step--error' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="deploy-status__step-dot" />
                <span className="deploy-status__step-label">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <DeployMessageFeed messages={feed} />

      {isSuccess && projectUrl && (
        <p className="deploy-status__primary-url">
          <a href={projectUrl} target="_blank" rel="noreferrer">
            Открыть проект
          </a>
        </p>
      )}

      {serviceUrls.length > 0 && (
        <ul className="deploy-status__urls">
          {serviceUrls.map((u) => (
            <li key={`${u.service}-${u.url}`}>
              <a href={u.url} target="_blank" rel="noreferrer">
                {u.service}: {u.url}
              </a>
            </li>
          ))}
        </ul>
      )}

      {deployment.updated_at && !compact && (
        <p className="deploy-status__updated">
          Обновлено: {new Date(deployment.updated_at).toLocaleString('ru')}
        </p>
      )}
    </div>
  )
}
