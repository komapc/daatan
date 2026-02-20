import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BotsTable from '../BotsTable'

export default async function AdminBotsPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/admin/forecasts')
  return <BotsTable />
}
