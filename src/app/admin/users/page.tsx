import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import UsersTable from '../UsersTable'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/admin/forecasts')
  return <UsersTable />
}
