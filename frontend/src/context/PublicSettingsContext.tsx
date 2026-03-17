import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../api/client'

export type PublicSettings = {
  registration_open: boolean
}

const defaultSettings: PublicSettings = { registration_open: true }

const PublicSettingsContext = createContext<PublicSettings>(defaultSettings)

export function PublicSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)

  useEffect(() => {
    api.get<PublicSettings>('/public/settings/')
      .then((r) => setSettings({ registration_open: r.data.registration_open ?? true }))
      .catch(() => {})
  }, [])

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  )
}

export function usePublicSettings(): PublicSettings {
  return useContext(PublicSettingsContext) ?? defaultSettings
}
