'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tag {
  name: string
  slug: string
}

interface TagFilterProps {
  tags: Tag[]
  selectedTag: string | null
}

export function TagFilter({ tags, selectedTag }: TagFilterProps) {
  const pathname = usePathname()

  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Link
        href={pathname}
        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
          !selectedTag
            ? 'bg-blue-600 text-white'
            : 'bg-navy-800 text-gray-400 border border-navy-600 hover:border-blue-500 hover:text-blue-400'
        }`}
      >
        All
      </Link>
      {tags.map(tag => (
        <Link
          key={tag.slug}
          href={`${pathname}?tag=${tag.slug}`}
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            selectedTag === tag.slug
              ? 'bg-blue-600 text-white'
              : 'bg-navy-800 text-gray-400 border border-navy-600 hover:border-blue-500 hover:text-blue-400'
          }`}
        >
          {tag.name}
        </Link>
      ))}
    </div>
  )
}
