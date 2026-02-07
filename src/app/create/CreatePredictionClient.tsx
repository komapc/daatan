'use client'

import { useState } from 'react'
import { Zap, Edit3 } from 'lucide-react'
import ExpressPredictionClient from '@/app/predictions/express/ExpressPredictionClient'
import { PredictionWizard } from '@/components/predictions/PredictionWizard'

interface CreatePredictionClientProps {
  userId: string
}

export default function CreatePredictionClient({ userId }: CreatePredictionClientProps) {
  const [mode, setMode] = useState<'express' | 'manual'>('express')

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
        <ExpressPredictionClient userId={userId} />
      ) : (
        <PredictionWizard isExpressFlow={false} />
      )}
    </div>
  )
}
