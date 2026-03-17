'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClientLogger } from '@/lib/client-logger'
import { toast } from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
import {
  Calendar,
  Users,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Trash2,
  Edit2,
  Gavel,
  Lock,
  EyeOff,
  MoreHorizontal,
  Languages,
  Loader2,
} from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'
import { UserLink } from '@/components/UserLink'
import Speedometer from './Speedometer'

export type Prediction = {
  id: string
  slug?: string | null
  claimText: string
  outcomeType: string
  status: string
  lockedAt?: string | Date | null
  resolveByDatetime: string | Date
  author: {
    id: string
    name: string | null
    username?: string | null
    image?: string | null
    rs?: number
    role?: 'USER' | 'RESOLVER' | 'ADMIN'
  }
  newsAnchor?: {
    id: string
    title: string
    source?: string | null
    imageUrl?: string | null
  } | null
  isPublic?: boolean
  tags?: { name: string }[]
  options?: Array<{
    id: string
    text: string
    isCorrect?: boolean | null
    commitmentsCount?: number
  }>
  _count: {
    commitments: number
  }
  totalCuCommitted?: number
  userHasCommitted?: boolean
  yesCount?: number
  noCount?: number
}

interface ForecastCardProps {
  prediction: Prediction
  showModerationControls?: boolean
}

export default function ForecastCard({
  prediction,
  showModerationControls = false,
}: ForecastCardProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('forecast')
  const tt = useTranslations('translate')
  const locale = useLocale()
  const [isApproving, setIsApproving] = useState(false)
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Translation state
  const [translatedClaim, setTranslatedClaim] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslated, setShowTranslated] = useState(locale !== 'en')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (locale === 'en' || !prediction.id || translatedClaim) return

    const triggerTranslation = async () => {
      setIsTranslating(true)
      try {
        const response = await fetch(`/api/forecasts/${prediction.id}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: locale }),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.claimText) {
            setTranslatedClaim(data.claimText)
          }
        }
      } catch (err) {
        // Silent error for feed cards
      } finally {
        setIsTranslating(false)
      }
    }

    triggerTranslation()
  }, [prediction.id, locale, translatedClaim])

  const canAdminister =
    showModerationControls && session?.user?.role === 'ADMIN'
  const canResolve =
    showModerationControls &&
    (session?.user?.role === 'RESOLVER' || session?.user?.role === 'ADMIN') &&
    (prediction.status === 'ACTIVE' || prediction.status === 'PENDING')
  const canApprove =
    showModerationControls &&
    prediction.status === 'PENDING_APPROVAL' &&
    (session?.user?.role === 'ADMIN' || session?.user?.role === 'APPROVER')

  const isLocked = !!prediction.lockedAt
  const isEditable =
    (prediction.status === 'DRAFT' ||
      prediction.status === 'ACTIVE' ||
      prediction.status === 'PENDING') &&
    (!isLocked || session?.user?.role === 'ADMIN')

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('deleteConfirm'))) return

    try {
      const response = await fetch(`/api/admin/forecasts/${prediction.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        router.refresh()
        toast.success(t('deleteSuccess'))
      } else {
        toast.error(t('deleteError'))
      }
    } catch (error) {
      createClientLogger('ForecastCard').error({ err: error }, 'Error deleting forecast')
      toast.error(t('deleteError'))
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/forecasts/${prediction.slug || prediction.id}/edit`)
  }

  const handleResolve = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/forecasts/${prediction.slug || prediction.id}`)
  }

  const handleApprove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsApproving(true)
    try {
      const response = await fetch(`/api/admin/forecasts/${prediction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (response.ok) {
        router.refresh()
        toast.success(t('approveSuccess'))
      } else {
        toast.error(t('approveError'))
        setIsApproving(false)
      }
    } catch (error) {
      createClientLogger('ForecastCard').error({ err: error }, 'Error approving forecast')
      toast.error(t('approveError'))
      setIsApproving(false)
    }
  }

  const handleReject = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('rejectConfirm'))) return
    try {
      const response = await fetch(`/api/admin/forecasts/${prediction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VOID' }),
      })
      if (response.ok) {
        router.refresh()
        toast.success(t('rejectSuccess'))
      } else {
        toast.error(t('rejectError'))
      }
    } catch (error) {
      createClientLogger('ForecastCard').error({ err: error }, 'Error rejecting forecast')
      toast.error(t('rejectError'))
    }
  }

  const handleCardClick = () => {
    router.push(`/forecasts/${prediction.slug || prediction.id}`)
  }

  useEffect(() => {
    if (!showAdminMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAdminMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { passive: true })
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAdminMenu])

  const formatDate = (date: string | Date) => {
    if (!isMounted) return ''
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          icon: <Clock className="w-3 h-3" />,
          className: 'bg-gray-100 text-gray-700',
          label: t('draft')
        }
      case 'ACTIVE':
        return {
          icon: <TrendingUp className="w-3 h-3" />,
          className: 'bg-green-100 text-green-700',
          label: t('active')
        }
      case 'PENDING':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          className: 'bg-yellow-100 text-yellow-700',
          label: t('pending')
        }
      case 'PENDING_APPROVAL':
        return {
          icon: <Clock className="w-3 h-3" />,
          className: 'bg-amber-100 text-amber-700',
          label: t('pendingApproval')
        }
      case 'RESOLVED_CORRECT':
        return {
          icon: <CheckCircle2 className="w-3 h-3" />,
          className: 'bg-blue-100 text-blue-700',
          label: t('correct')
        }
      case 'RESOLVED_WRONG':
        return {
          icon: <XCircle className="w-3 h-3" />,
          className: 'bg-red-100 text-red-700',
          label: t('wrong')
        }
      case 'UNRESOLVABLE':
      case 'VOID':
        return {
          icon: <HelpCircle className="w-3 h-3" />,
          className: 'bg-orange-100 text-orange-700',
          label: status === 'VOID' ? t('void') : t('unresolvable')
        }
      default:
        return {
          icon: <Clock className="w-3 h-3" />,
          className: 'bg-gray-100 text-gray-700',
          label: status
        }
    }
  }

  const badge = getStatusBadge(prediction.status)

  return (
    <div
      onClick={handleCardClick}
      className="group block p-4 sm:p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Mini Gauge (Desktop-only on side) */}
        {prediction.status === 'ACTIVE' && (
          <div className="hidden sm:block flex-shrink-0">
            {prediction._count.commitments === 0 ? (
              <div className="w-16 h-10 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-xs text-gray-300 font-medium">—</span>
              </div>
            ) : prediction.outcomeType === 'BINARY' ? (
              <Speedometer
                percentage={Math.round(((prediction.yesCount || 0) / ((prediction.yesCount || 0) + (prediction.noCount || 0))) * 100)}
                label=""
                color="green"
                size="xs"
              />
            ) : prediction.outcomeType === 'MULTIPLE_CHOICE' && prediction.options && prediction.options.length > 0 && prediction._count.commitments > 0 ? (() => {
              const sortedOptions = [...prediction.options].sort((a, b) => (b.commitmentsCount || 0) - (a.commitmentsCount || 0))
              const topOption = sortedOptions[0]
              const pct = Math.round(((topOption.commitmentsCount || 0) / prediction._count.commitments) * 100)
              return (
                <Speedometer
                  percentage={pct}
                  label=""
                  color="green"
                  size="xs"
                />
              )
            })() : null}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header: Status & Category */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${badge.className}`}>
              {badge.icon}
              {badge.label}
            </span>
            {prediction.totalCuCommitted !== undefined && prediction.totalCuCommitted > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-100">
                💰 {prediction.totalCuCommitted} CU
              </span>
            )}
            {prediction.tags && prediction.tags.length > 0 && (
              <>
                {prediction.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.name}
                    className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] sm:text-xs font-medium rounded-full border border-blue-100"
                  >
                    {tag.name}
                  </span>
                ))}
                {prediction.tags.length > 2 && (
                  <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] sm:text-xs font-medium rounded-full border border-gray-100">
                    +{prediction.tags.length - 2}
                  </span>
                )}
              </>
            )}
            {prediction.isPublic === false && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full border border-gray-200" title="This forecast is unlisted — only visible via direct link.">
                <EyeOff className="w-3 h-3" />
                Unlisted
              </span>
            )}
            {locale !== 'en' && translatedClaim && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTranslated(!showTranslated); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border transition-colors ${
                  showTranslated ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
                title={showTranslated ? tt('showOriginal') : tt('translate')}
              >
                <Languages className="w-3 h-3" />
                {showTranslated ? 'Original' : 'Hebrew'}
              </button>
            )}
            {isTranslating && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            )}
          </div>

          {/* Claim Text */}
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
            {showTranslated && translatedClaim ? translatedClaim : prediction.claimText}
          </h3>

          {/* News Context (Optional) */}
          {prediction.newsAnchor && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg border border-gray-100">
              {prediction.newsAnchor.imageUrl && (
                <Image
                  src={prediction.newsAnchor.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="rounded object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs text-gray-400 font-medium truncate uppercase tracking-tight">
                  {t('source')}: {prediction.newsAnchor.source || 'News'}
                </p>
                <p className="text-xs text-gray-600 font-medium truncate">
                  {prediction.newsAnchor.title}
                </p>
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center flex-wrap gap-y-2 gap-x-4 text-xs sm:text-sm text-gray-500">
            {/* Author */}
            <UserLink
              userId={prediction.author.id}
              username={prediction.author.username}
              name={prediction.author.name}
              image={prediction.author.image}
              showAvatar={true}
              avatarSize={24}
              className="pr-4 border-r border-gray-100 last:border-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-700 truncate max-w-[120px]">
                  {prediction.author.name || t('anonymous')}
                </span>
                {prediction.author.role && (
                  <span className="mt-0.5">
                    <RoleBadge role={prediction.author.role} size="sm" />
                  </span>
                )}
              </div>
            </UserLink>

            {/* Resolve By Date */}
            {(() => {
              const daysUntil = Math.ceil((new Date(prediction.resolveByDatetime).getTime() - Date.now()) / 86400000)
              const dateClass = prediction.status === 'ACTIVE'
                ? daysUntil <= 3 ? 'text-red-500' : daysUntil <= 7 ? 'text-amber-500' : 'text-gray-400'
                : 'text-gray-400'
              return (
                <div className={`flex items-center gap-1.5 ${dateClass}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span suppressHydrationWarning>{formatDate(prediction.resolveByDatetime)}</span>
                </div>
              )
            })()}

            {/* Commitment Count */}
            {prediction._count.commitments > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">{prediction._count.commitments}</span>
                <span className="hidden sm:inline">{t('commitmentsLabel')}</span>
              </div>
            )}

            {/* User Committed Indicator */}
            {prediction.userHasCommitted && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t('committedLabel')}</span>
              </div>
            )}
          </div>
        </div>

        {(canAdminister || canResolve || canApprove) && (
          <div className="flex-shrink-0 self-start mt-1" ref={menuRef}>
            {canApprove ? (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
                  title="Approve forecast"
                  aria-label="Approve forecast"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('approve')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isApproving}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                  title="Reject forecast"
                  aria-label="Reject forecast"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t('reject')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAdminMenu(v => !v) }}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Admin actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showAdminMenu && (
                  <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                    {canResolve && (
                      <button
                        onClick={handleResolve}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        {t('resolve')}
                      </button>
                    )}
                    {canAdminister && isEditable && (
                      <button
                        onClick={handleEdit}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {t('edit')}
                      </button>
                    )}
                    {canAdminister && (
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('delete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-shrink-0 self-center">
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
