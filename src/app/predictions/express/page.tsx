import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import ExpressPredictionClient from './ExpressPredictionClient'

export default async function ExpressPredictionPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/predictions/express')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Express Forecast</h1>
        <p className="text-gray-600">
          Quickly create a forecast by describing what you want to predict. 
          We&apos;ll search for relevant articles and generate a structured forecast for you.
        </p>
      </div>

      <ExpressPredictionClient userId={session.user.id} />
    </div>
  )
}
