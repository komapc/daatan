'use client'

import { useSession } from 'next-auth/react'
import { Shield } from 'lucide-react'
import { ResolutionForm } from '@/components/predictions/ResolutionForm'
import { useRouter } from 'next/navigation'

interface ModeratorResolutionSectionProps {
  predictionId: string
  predictionStatus: string
}

export function ModeratorResolutionSection({ 
  predictionId, 
  predictionStatus 
}: ModeratorResolutionSectionProps) {
  const { data: session } = useSession()
  const router = useRouter()

  // Only show for resolvers/admins on active or pending predictions
  const canResolve = 
    session?.user?.role === 'RESOLVER' || 
    session?.user?.role === 'ADMIN'

  const isResolvable = 
    predictionStatus === 'ACTIVE' || 
    predictionStatus === 'PENDING'

  if (!canResolve || !isResolvable) {
    return null
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Resolver Actions</h2>
      </div>
      <ResolutionForm 
        predictionId={predictionId} 
        onResolved={() => router.refresh()}
      />
    </div>
  )
}
