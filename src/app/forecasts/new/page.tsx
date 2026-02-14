import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PlusCircle } from 'lucide-react'
import { ForecastWizard } from '@/components/forecasts/ForecastWizard'

interface PageProps {
  searchParams: { from?: string }
}

export default async function NewPredictionPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin?callbackUrl=/predictions/new')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <PlusCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Prediction</h1>
      </div>
      
      <ForecastWizard isExpressFlow={searchParams.from === 'express'} />
    </div>
  )
}

