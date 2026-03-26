import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import type { Metadata } from 'next'
import FeedClient from '@/app/FeedClient'

export const dynamic = 'force-dynamic'

const META: Record<string, { title: string; description: string }> = {
  he: {
    title: 'DAATAN - שוק תחזיות',
    description: 'הוכח שצדקת — בלי לצעוק לחלל.',
  },
  ru: {
    title: 'DAATAN - Рынок прогнозов',
    description: 'Докажи, что был прав — без крика в пустоту.',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const meta = META[locale] ?? META.he

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: 'https://daatan.com',
      languages: {
        'x-default': 'https://daatan.com',
        en: 'https://daatan.com',
        he: 'https://daatan.com/he',
        ru: 'https://daatan.com/ru',
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://daatan.com/${locale}`,
    },
  }
}

function FeedLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
    </div>
  )
}

export default function LocaleHomePage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedClient initialPredictions={[]} />
    </Suspense>
  )
}
