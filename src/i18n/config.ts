/** Re-export locale constants for use in client components. */
export const locales = ['en', 'he', 'ru', 'eo'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  he: 'עברית',
  ru: 'Русский',
  eo: 'Esperanto',
}

/** Returns `true` when the locale uses right-to-left script. */
export const isRtl = (locale: Locale): boolean => locale === 'he'
