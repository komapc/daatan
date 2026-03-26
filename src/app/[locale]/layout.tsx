import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import type { Metadata } from 'next'

/**
 * Locale sub-routes: /he/... and /ru/...
 *
 * Safety invariant: this layout calls notFound() for any segment that is NOT
 * an explicitly supported non-default locale. This prevents arbitrary path
 * segments (e.g. /about, /profile) from accidentally matching this dynamic
 * route and producing 404-looking pages.
 *
 * No next-intl middleware is used — these pages are served by Next.js static
 * segment priority. English routes are completely unaffected.
 */

const ALLOWED_LOCALES = ['he', 'ru'] as const
type AllowedLocale = (typeof ALLOWED_LOCALES)[number]

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    alternates: {
      languages: {
        'x-default': 'https://daatan.com',
        en: 'https://daatan.com',
        he: 'https://daatan.com/he',
        ru: 'https://daatan.com/ru',
      },
    },
    openGraph: {
      locale,
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
    notFound()
  }

  const messages =
    locale === 'he'
      ? (await import('../../../messages/he.json')).default
      : (await import('../../../messages/ru.json')).default

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
