'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Zap, Edit3 } from 'lucide-react'
import ExpressForecastClient from '@/app/forecasts/express/ExpressForecastClient'
import { ForecastWizard } from '@/components/forecasts/ForecastWizard'

interface CreateForecastClientProps {
  userId: string
}

export default function CreateForecastClient({ userId }: CreateForecastClientProps) {
  const searchParams = useSearchParams()
  const fromExpress = searchParams.get('from') === 'express'
  const [mode, setMode] = useState<'express' | 'manual'>('express')

  // When redirected from express generation, go straight to the wizard
  if (fromExpress) {
    return (
      <div className="max-w-4xl mx-auto">
        <ForecastWizard isExpressFlow={true} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode Toggle */}
      <div className="mb-6 flex items-center justify-center gap-2 bg-gray-100 p-1 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setMode('express')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all
            ${mode === 'express'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <Zap className="w-4 h-4" />
          Express
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all
            ${mode === 'manual'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <Edit3 className="w-4 h-4" />
          Manual
        </button>
      </div>

      {/* Content */}
      {mode === 'express' ? (
        <ExpressForecastClient userId={userId} />
      ) : (
        <ForecastWizard isExpressFlow={false} />
      )}
    </div>
  )
}
