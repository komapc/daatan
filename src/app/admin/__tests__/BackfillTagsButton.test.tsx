import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSession } from 'next-auth/react'
import BackfillTagsButton from '../BackfillTagsButton'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'id') },
}))

const mockedSession = (role: string | null) =>
  vi.mocked(useSession).mockReturnValue({
    data: role ? { user: { role } } : null,
    status: role ? 'authenticated' : 'unauthenticated',
  } as never)

const globalFetch = global.fetch
afterEach(() => { global.fetch = globalFetch })

describe('BackfillTagsButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing for non-admins', () => {
    mockedSession('USER')
    const { container } = render(<BackfillTagsButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders preview + run buttons for admins', () => {
    mockedSession('ADMIN')
    render(<BackfillTagsButton />)
    expect(screen.getByText(/Preview tag backfill/i)).toBeInTheDocument()
    expect(screen.getByText(/Run backfill/i)).toBeInTheDocument()
  })

  it('Preview calls the endpoint in dry-run mode (no write)', async () => {
    mockedSession('ADMIN')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ dryRun: true, scanned: 1, updated: 1, skipped: 0, nextCursor: null, totalUntagged: 1, items: [] }),
    }) as never

    render(<BackfillTagsButton />)
    fireEvent.click(screen.getByText(/Preview tag backfill/i))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.dryRun).toBe(true)
  })
})
