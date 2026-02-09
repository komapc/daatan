import { Shield, ShieldCheck } from 'lucide-react'

type Role = 'USER' | 'RESOLVER' | 'ADMIN' | null | undefined

interface RoleBadgeProps {
  role: Role
  size?: 'sm' | 'md'
}

export const RoleBadge = ({ role, size = 'sm' }: RoleBadgeProps) => {
  if (role !== 'ADMIN' && role !== 'RESOLVER') return null

  const baseClasses =
    'inline-flex items-center gap-1 rounded-full font-medium tracking-wider uppercase'
  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  if (role === 'ADMIN') {
    return (
      <span className={`${baseClasses} ${sizeClasses} bg-red-100 text-red-700`}>
        <Shield className="w-3 h-3" />
        Admin
      </span>
    )
  }

  return (
    <span className={`${baseClasses} ${sizeClasses} bg-blue-100 text-blue-700`}>
      <ShieldCheck className="w-3 h-3" />
      Resolver
    </span>
  )
}

