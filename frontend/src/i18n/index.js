import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import uk from './uk.json'
import en from './en.json'

const saved = (() => {
  try { return JSON.parse(localStorage.getItem('cthulhu-ui-prefs') ?? '{}').state?.lang } catch { return null }
})()

i18n
  .use(initReactI18next)
  .init({
    resources: { uk: { translation: uk }, en: { translation: en } },
    lng: saved ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
