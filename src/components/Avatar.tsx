'use client'

import Image from 'next/image'
import { useState } from 'react'

interface AvatarProps {
  src: string | null | undefined
  name: string | null | undefined
  size?: number
  className?: string
}

export function Avatar({ src, name, size = 32, className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  const initial = name?.charAt(0)?.toUpperCase() || '?'
  
  // Show fallback if no src or image failed to load
  if (!src || imageError) {
    return (
      <div 
        className={`rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {initial}
      </div>
    )
  }
  
  return (
    <Image
      src={src}
      alt={name || 'User'}
      width={size}
      height={size}
      className={`rounded-full border border-gray-200 ${className}`}
      onError={() => setImageError(true)}
    />
  )
}
