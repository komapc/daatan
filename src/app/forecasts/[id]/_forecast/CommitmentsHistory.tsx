'use client'
import { Users } from 'lucide-react'
import { UserLink } from '@/components/UserLink'
import type { Prediction } from './types'

interface Props {
  prediction: Prediction
}

export function CommitmentsHistory({ prediction }: Props) {
  if (prediction.commitments.length === 0) return null
  return (
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" />
        Forecasts History
      </h2>
      <div className="border border-navy-600 rounded-lg divide-y divide-navy-600">
        {prediction.commitments.map((commitment) => (
          <div key={commitment.id} className="p-4 flex items-center justify-between">
            <UserLink
              userId={commitment.user.id}
              username={commitment.user.username}
              name={commitment.user.name}
              image={commitment.user.image}
              showAvatar={true}
              avatarSize={32}
            >
              <div>
                <div className="font-medium text-white">{commitment.user.name}</div>
                <div className="text-sm text-gray-500">
                  {prediction.outcomeType === 'BINARY'
                    ? (commitment.binaryChoice ? 'Will happen' : "Won't happen")
                    : commitment.option?.text}
                </div>
              </div>
            </UserLink>
            <div className="text-right">
              <div className="font-semibold text-gray-400">
                {commitment.probability ? `${Math.round(commitment.probability * 100)}%` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
