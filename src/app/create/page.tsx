import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PlusCircle } from 'lucide-react'
import CreateForecastClient from './CreateForecastClient'

export default async function CreatePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/create')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 lg:mb-8 max-w-4xl mx-auto">
        <PlusCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Forecast</h1>
          <p className="text-sm text-gray-600 mt-1">
            Use Express for quick AI-assisted creation, or Manual for full control
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-10 bg-gray-100 rounded-lg w-48 mx-auto mb-6" />
          <div className="h-64 bg-gray-50 rounded-xl" />
        </div>
      }>
        <CreateForecastClient userId={session.user.id} />
      </Suspense>
    </div>
  )
}
