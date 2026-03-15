import { useState } from 'react'

export default function TabPanel({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[]
}) {
  const [active, setActive] = useState(tabs[0]?.id || '')
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  )
}
