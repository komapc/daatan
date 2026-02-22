import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchUrlContent } from '@/lib/utils/scraper'
import dns from 'dns'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock dns to return private IPs for some domains
vi.mock('dns', () => ({
    default: {
        resolve4: (hostname: string, callback: (err: NodeJS.ErrnoException | null, addresses: string[]) => void) => {
            if (hostname === 'private.example.com') {
                callback(null, ['192.168.1.100'])
            } else if (hostname === 'public.example.com') {
                callback(null, ['8.8.8.8'])
            } else {
                callback(null, ['9.9.9.9'])
            }
        }
    }
}))

describe('fetchUrlContent SSRF Protection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '<html><body>Test Content</body></html>'
        })
    })

    it('rejects HTTP protocol', async () => {
        await expect(fetchUrlContent('http://example.com/test')).rejects.toThrow('Only HTTPS URLs are allowed')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects invalid URL', async () => {
        await expect(fetchUrlContent('not-a-url')).rejects.toThrow('Invalid URL format')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects localhost', async () => {
        await expect(fetchUrlContent('https://localhost/api')).rejects.toThrow('Fetching internal or private IPs is forbidden')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects 127.0.0.1 directly', async () => {
        await expect(fetchUrlContent('https://127.0.0.1/test')).rejects.toThrow('Fetching internal or private IPs is forbidden')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects 169.254.169.254 directly', async () => {
        await expect(fetchUrlContent('https://169.254.169.254/latest/meta-data')).rejects.toThrow('Fetching internal or private IPs is forbidden')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects domains that resolve to private IPs', async () => {
        await expect(fetchUrlContent('https://private.example.com/api')).rejects.toThrow('Resolved domain points to a private/internal IP')
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('allows valid HTTPS URLs with public IPs', async () => {
        const result = await fetchUrlContent('https://public.example.com/test')
        expect(result).toBe('Test Content')
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch).toHaveBeenCalledWith('https://public.example.com/test', expect.any(Object))
    })
})
