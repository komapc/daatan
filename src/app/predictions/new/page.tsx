import { PlusCircle } from 'lucide-react'
import { PredictionWizard } from '@/components/predictions/PredictionWizard'

export default function NewPredictionPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <PlusCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Prediction</h1>
      </div>
      
      <PredictionWizard />
    </div>
  )
}

