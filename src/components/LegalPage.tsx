import { LucideIcon } from 'lucide-react'
import React from 'react'

interface LegalPageProps {
  title: string
  Icon: LucideIcon
  children: React.ReactNode
}

export default function LegalPage({ title, Icon, children }: LegalPageProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
      </div>
      
      <div className="bg-navy-800 border border-navy-600 rounded-xl p-6 space-y-6 text-text-secondary">
        {children}
      </div>
    </div>
  )
}
