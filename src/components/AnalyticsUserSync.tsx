'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import { identifyUser } from '@/lib/analytics'

/**
 * Invisible component that associates the authenticated user's ID with their
 * GA4 session via gtag('set', { user_id }). Runs once per session activation.
 */
export default function AnalyticsUserSync() {
  const { data: session } = useSession()
  const identified = useRef(false)

  useEffect(() => {
    if (session?.user?.id && !identified.current) {
      identifyUser(session.user.id)
      identified.current = true
    }
  }, [session?.user?.id])

  return null
}
