import React, { createContext, useContext, useState } from 'react'
import { translations, type Lang } from '../lib/i18n'

interface I18nContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: typeof translations.es
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('semana-lista:lang')
    return saved === 'ca' ? 'ca' : 'es'
  })

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('semana-lista:lang', l)
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
