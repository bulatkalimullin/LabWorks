import { useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, Info, ScrollText } from 'lucide-react'
import type { DeployFeedMessage } from '../hooks/useDeployMessageFeed'

type Props = {
  messages: DeployFeedMessage[]
}

function Icon({ kind }: { kind: DeployFeedMessage['kind'] }) {
  if (kind === 'success') return <CheckCircle2 size={14} className="deploy-feed__icon deploy-feed__icon--ok" aria-hidden />
  if (kind === 'error') return <AlertCircle size={14} className="deploy-feed__icon deploy-feed__icon--err" aria-hidden />
  return <Info size={14} className="deploy-feed__icon" aria-hidden />
}

export default function DeployMessageFeed({ messages }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.id])

  if (!messages.length) return null

  return (
    <div className="deploy-feed-shell">
      <div className="deploy-feed-shell__head">
        <span className="deploy-feed-shell__title">
          <ScrollText size={14} aria-hidden />
          Журнал статусов
        </span>
        <span className="deploy-feed-shell__count">{messages.length}</span>
      </div>
      <div className="deploy-feed-scroll" ref={scrollRef}>
        <ul className="deploy-feed" aria-live="polite" aria-relevant="additions">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className={`deploy-feed__item deploy-feed__item--${msg.kind} deploy-feed__item--enter`}
            >
              <Icon kind={msg.kind} />
              <span className="deploy-feed__text">{msg.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
