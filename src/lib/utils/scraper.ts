import { createLogger } from '@/lib/logger'
import dns from 'dns'
import util from 'util'

const log = createLogger('scraper')
const resolve4 = util.promisify(dns.resolve4)

// Check if an IP address is in a private/local range
export function isPrivateIP(ip: string): boolean {
  // IPv4 mapped IPv6 addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7)
  }

  // localhost / loopback
  if (ip === '::1' || ip.startsWith('127.')) return true

  // 0.0.0.0/8 (Current network)
  if (ip.startsWith('0.')) return true

  // private network ranges (RFC 1918)
  // 10.0.0.0/8
  if (ip.startsWith('10.')) return true
  // 192.168.0.0/16
  if (ip.startsWith('192.168.')) return true
  // 172.16.0.0/12
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) return true
  }

  // Carrier-grade NAT (100.64.0.0/10)
  if (ip.startsWith('100.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10)
    if (secondOctet >= 64 && secondOctet <= 127) return true
  }

  // IETF Protocol Assignments (192.0.0.0/24)
  if (ip.startsWith('192.0.0.')) return true

  // Test-Net / Documentation (RFC 5737)
  if (ip.startsWith('192.0.2.')) return true // TEST-NET-1
  if (ip.startsWith('198.51.100.')) return true // TEST-NET-2
  if (ip.startsWith('203.0.113.')) return true // TEST-NET-3

  // Benchmarking (198.18.0.0/15)
  if (ip.startsWith('198.18.') || ip.startsWith('198.19.')) return true

  // link local (AWS IMDS, etc) (169.254.0.0/16)
  if (ip.startsWith('169.254.')) return true

  // Multicast (224.0.0.0/4)
  const firstOctet = parseInt(ip.split('.')[0], 10)
  if (firstOctet >= 224 && firstOctet <= 239) return true

  // Reserved (240.0.0.0/4)
  if (firstOctet >= 240) return true

  return false
}

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error('Invalid URL format')
    }

    // SSRF Protection 1: Enforce HTTPS
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed')
    }

    // SSRF Protection 2: Resolve DNS and check if the IP is private
    // Note: We resolve it before fetching. In an ideal world we would
    // pin the fetched IP, but node-fetch / global fetch doesn't expose
    // the resolved IP. This provides simple protection against basic
    // DNS rebinding or direct IP passing.
    try {
      // First check if the hostname itself is an IP
      if (isPrivateIP(parsedUrl.hostname) || parsedUrl.hostname === 'localhost') {
        throw new Error('Fetching internal or private IPs is forbidden')
      }

      // Then resolve domain to IPs and check them
      const ips = await resolve4(parsedUrl.hostname)
      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          throw new Error('Resolved domain points to a private/internal IP')
        }
      }
    } catch (dnsErr) {
      if (dnsErr instanceof Error && dnsErr.message.includes('forbidden')) {
        throw dnsErr
      }
      // If DNS resolution fails, let fetch handle the network error,
      // but if it's our own error, bubble it up.
      if (dnsErr instanceof Error && dnsErr.message.includes('Resolved domain')) {
        throw dnsErr
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }

    const html = await response.text()

    // Simple HTML to text extraction
    // Remove scripts and styles
    let text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
    text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ')

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim()

    // Limit text length to avoid token limits (e.g., first 10k characters)
    return text.substring(0, 10000)
  } catch (error) {
    log.error({ err: error, url }, 'Scraper error')
    throw error
  }
}
