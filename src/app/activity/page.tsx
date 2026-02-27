'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, Loader2, TrendingUp, Clock, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar } from '@/components/Avatar'
import { createClientLogger } from '@/lib/client-logger'
import { useTranslations } from 'next-intl'

const log = createClientLogger('ActivityFeed')

interface ActivityItem {
  id: string
  cuCommitted: number
  binaryChoice: boolean | null
  createdAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    image: string | null
    rs: number
  }
  prediction: {
    id: string
    slug: string | null
    claimText: string
    status: string
    outcomeType: string
  }
  option?: {
    id: string
    text: string
  } | null
}

export default function ActivityFeedPage() {
  const t = useTranslations('activity')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/commitments/activity?limit=30')
        if (res.ok) {
          const data = await res.json()
          setActivity(data.activity)
        }
      } catch (error) {
        log.error({ err: error }, 'Failed to fetch activity')
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivity()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    )
  }

  const getChoiceLabel = (item: ActivityItem) => {
    if (item.option) return item.option.text
    if (item.binaryChoice === true) return t('willHappen')
    if (item.binaryChoice === false) return t('wontHappen')
    return '—'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">{t('subtitle')}</p>

      {activity.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">{t('noActivity')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" aria-hidden="true" />

          <div className="space-y-0">
            {activity.map((item) => (
              <div key={item.id} className="relative flex gap-4 pb-6 group">
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center group-hover:border-blue-300 transition-colors">
                    {item.user.image ? (
                      <Avatar src={item.user.image} name={item.user.name} size={32} />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {item.user.name || item.user.username || 'Anonymous'}
                      </span>
                      {' '}{t('committed')}{' '}
                      <span className="font-semibold text-amber-600">{item.cuCommitted} CU</span>
                      {' '}{t('cuOn')}{' '}
                      <span className="font-medium text-blue-600">
                        &quot;{getChoiceLabel(item)}&quot;
                      </span>
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </div>
                  </div>

                  <Link
                    href={`/forecasts/${item.prediction.slug || item.prediction.id}`}
                    className="block text-sm text-gray-600 hover:text-blue-600 line-clamp-2 transition-colors"
                  >
                    {item.prediction.claimText}
                  </Link>

                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>RS: {item.user.rs.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
