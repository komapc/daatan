'use client'

import { useEffect, useState } from 'react'

export const StagingBanner = () => {
  const [isStaging, setIsStaging] = useState(false)

  useEffect(() => {
    // Detect staging by hostname
    const hostname = window.location.hostname
    setIsStaging(hostname.includes('staging'))
  }, [])

  if (!isStaging) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1 text-sm font-medium">
      ⚠️ STAGING ENVIRONMENT - Changes here are for testing only
    </div>
  )
}

