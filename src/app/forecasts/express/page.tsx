import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import ExpressForecastClient from './ExpressForecastClient'

export default async function ExpressForecastPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/forecasts/express')
  }

  return <ExpressForecastClient userId={session.user.id} />
}
