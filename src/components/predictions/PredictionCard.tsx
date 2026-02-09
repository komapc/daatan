import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'

export type Prediction = {
  id: string
  claimText: string
  domain?: string | null
  outcomeType: string
  status: string
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
  _count: {
    commitments: number
  }
  totalCuCommitted?: number
  userHasCommitted?: boolean
}

interface PredictionCardProps {
  prediction: Prediction
  showModerationControls?: boolean
}

export default function PredictionCard({
  prediction,
  showModerationControls = false,
}: PredictionCardProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const canAdminister =
    showModerationControls && session?.user?.role === 'ADMIN'
  const isEditable =
    prediction.status === 'DRAFT' ||
    prediction.status === 'ACTIVE' ||
    prediction.status === 'PENDING'

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prediction? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/admin/predictions/${prediction.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        router.refresh()
      } else {
        alert('Failed to delete prediction')
      }
    } catch (error) {
      console.error('Error deleting prediction:', error)
      alert('Error deleting prediction')
    }
  }

  const handleEdit = () => {
    // TODO: Implement actual edit page/modal
    alert('Edit functionality not yet implemented')
  }

  const formatDate = (date: string | Date) => {
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
          label: 'Draft' 
        }
      case 'ACTIVE':
        return { 
          icon: <TrendingUp className="w-3 h-3" />, 
          className: 'bg-green-100 text-green-700',
          label: 'Active' 
        }
      case 'PENDING':
        return { 
          icon: <AlertCircle className="w-3 h-3" />, 
          className: 'bg-yellow-100 text-yellow-700',
          label: 'Pending' 
        }
      case 'RESOLVED_CORRECT':
        return { 
          icon: <CheckCircle2 className="w-3 h-3" />, 
          className: 'bg-blue-100 text-blue-700',
          label: 'Correct' 
        }
      case 'RESOLVED_WRONG':
        return { 
          icon: <XCircle className="w-3 h-3" />, 
          className: 'bg-red-100 text-red-700',
          label: 'Wrong' 
        }
      case 'UNRESOLVABLE':
      case 'VOID':
        return { 
          icon: <HelpCircle className="w-3 h-3" />, 
          className: 'bg-orange-100 text-orange-700',
          label: status === 'VOID' ? 'Void' : 'Unresolvable' 
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
    <Link
      href={`/predictions/${prediction.id}`}
      className="group block p-4 sm:p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header: Status & Category */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${badge.className}`}>
              {badge.icon}
              {badge.label}
            </span>
            {prediction.domain && (
              <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] sm:text-xs font-medium rounded-full uppercase tracking-wider border border-gray-100">
                {prediction.domain}
              </span>
            )}
          </div>

          {/* Claim Text */}
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
            {prediction.claimText}
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
                  Source: {prediction.newsAnchor.source || 'News'}
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
            <div className="flex items-center gap-2 pr-4 border-r border-gray-100 last:border-0">
              <div className="relative">
                {prediction.author.image ? (
                  <Image
                    src={prediction.author.image}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full ring-1 ring-gray-100"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 ring-1 ring-gray-100">
                    {prediction.author.name?.charAt(0) || '?'}
                  </div>
                )}
                {prediction.author.rs !== undefined && (
                  <div className="absolute -top-1 -right-1 px-1 bg-white rounded-full text-[8px] font-bold text-gray-400 border border-gray-50 shadow-sm">
                    {prediction.author.rs}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-gray-700 truncate max-w-[120px]">
                  {prediction.author.name || 'Anonymous'}
                </span>
                {prediction.author.role && (
                  <span className="mt-0.5">
                    <RoleBadge role={prediction.author.role} size="sm" />
                  </span>
                )}
              </div>
            </div>

            {/* Resolve By Date */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span suppressHydrationWarning>{formatDate(prediction.resolveByDatetime)}</span>
            </div>

            {/* Commitment Count & CU */}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">{prediction._count.commitments}</span>
              <span className="hidden sm:inline">commitments</span>
              {prediction.totalCuCommitted !== undefined && prediction.totalCuCommitted > 0 && (
                <span className="text-gray-400">• {prediction.totalCuCommitted} CU</span>
              )}
            </div>

            {/* User Committed Indicator */}
            {prediction.userHasCommitted && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Committed</span>
              </div>
            )}
          </div>
        </div>

        {canAdminister && (
          <div className="flex-shrink-0 flex gap-2 self-start mt-1">
            {isEditable && (
              <button
                onClick={handleEdit}
                className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit Prediction"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete Prediction"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-shrink-0 self-center">
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
          </div>
        </div>
      </div>
    </Link>
  )
}
