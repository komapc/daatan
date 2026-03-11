import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ForecastWizard } from '@/components/forecasts/ForecastWizard'

export const dynamic = 'force-dynamic'

export default async function NewForecastPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/forecasts/new')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Create Manual Forecast</h1>
        <p className="text-gray-500 mt-2">Design your own prediction with custom resolution rules.</p>
      </div>
      <ForecastWizard />
    </div>
  )
}
