import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

/** Supported locales. */
export const locales = ['en', 'he'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export default getRequestConfig(async () => {
  // Read locale from cookie (set by language picker).
  // Falls back to default if cookie is missing or invalid.
  const cookieStore = cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value

  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
