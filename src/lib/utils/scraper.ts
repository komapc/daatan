export async function fetchUrlContent(url: string): Promise<string> {
  try {
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
    console.error('Scraper error:', error)
    throw error
  }
}
