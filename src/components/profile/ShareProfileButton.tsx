'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

export function ShareProfileButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`https://daatan.com/profile/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-700 border border-navy-600 hover:border-blue-500 hover:text-blue-400 text-gray-400 transition-colors"
      title="Copy profile link"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-teal" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Share
        </>
      )}
    </button>
  )
}
