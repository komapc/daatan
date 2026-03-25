import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import BotsTable from '../BotsTable'

export const dynamic = 'force-dynamic'

export default async function AdminBotsPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/')
  }

  return <BotsTable />
}
