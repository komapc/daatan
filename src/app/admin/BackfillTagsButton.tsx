'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tags, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface BackfillResponse {
  dryRun: boolean
  scanned: number
  updated: number
  skipped: number
  nextCursor: string | null
  totalUntagged: number
  items: { id: string; claimText: string; tags: string[] }[]
}

const BATCH = 25

async function callBackfill(body: { dryRun: boolean; limit: number; cursor?: string }): Promise<BackfillResponse> {
  const res = await fetch('/api/admin/backfill-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Backfill failed (${res.status})`)
  return res.json()
}

/**
 * ADMIN-only control to backfill LLM-suggested tags onto forecasts that have
 * none. "Preview" runs a dry-run batch; "Run" loops the cursor until done.
 */
export default function BackfillTagsButton() {
  const { data: session } = useSession()
  const [busy, setBusy] = useState(false)

  if (session?.user?.role !== 'ADMIN') return null

  const preview = async () => {
    setBusy(true)
    try {
      const r = await callBackfill({ dryRun: true, limit: BATCH })
      const sample = r.items.slice(0, 3).map(i => `“${i.claimText.slice(0, 40)}…” → ${i.tags.join(', ')}`).join('\n')
      toast.success(
        `${r.totalUntagged} forecast(s) have no tags.\nSample (dry-run, nothing written):\n${sample || '(none taggable in this batch)'}`,
        { duration: 8000 },
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!confirm('Backfill tags for ALL forecasts with none? This writes to the database and calls the LLM per forecast.')) return
    setBusy(true)
    const progress = toast.loading('Backfilling tags…')
    try {
      let cursor: string | null = null
      let updated = 0
      let skipped = 0
      do {
        const r: BackfillResponse = await callBackfill({ dryRun: false, limit: BATCH, cursor: cursor ?? undefined })
        updated += r.updated
        skipped += r.skipped
        cursor = r.nextCursor
        toast.loading(`Backfilling… ${updated} tagged, ${skipped} skipped`, { id: progress })
      } while (cursor)
      toast.success(`Done — ${updated} tagged, ${skipped} skipped (no tag suggested).`, { id: progress, duration: 6000 })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill failed', { id: progress })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={preview}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-navy-600 bg-navy-700 text-gray-300 hover:bg-navy-600 disabled:opacity-50 transition-colors text-sm"
        title="Dry-run: preview proposed tags without writing"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
        Preview tag backfill
      </button>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
        title="Assign suggested tags to all tag-less forecasts"
      >
        Run backfill
      </button>
    </div>
  )
}
