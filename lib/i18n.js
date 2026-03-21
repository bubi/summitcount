import { createContext, useContext, useState, useEffect } from 'react'
import de from '../locales/de.json'
import en from '../locales/en.json'

const locales = { de, en }
const I18nContext = createContext({ t: k => k, lang: 'de', setLang: () => {} })

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('de')

  useEffect(() => {
    const saved = localStorage.getItem('summitcount_lang')
    if (saved === 'de' || saved === 'en') setLangState(saved)
  }, [])

  function setLang(l) {
    setLangState(l)
    localStorage.setItem('summitcount_lang', l)
  }

  function t(key, vars = {}) {
    const str = locales[lang][key] ?? locales.de[key] ?? key
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  }

  return <I18nContext.Provider value={{ t, lang, setLang }}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  return useContext(I18nContext)
}
