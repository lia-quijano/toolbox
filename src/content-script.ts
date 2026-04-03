// Content script: extracts page metadata and text for the popup

interface PageMetadata {
  title: string
  description: string
  ogDescription: string
  ogImage: string
  url: string
  pageText: string
}

function extractMetadata(): PageMetadata {
  const getMeta = (name: string): string => {
    const el =
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`)
    return el?.getAttribute('content')?.trim() || ''
  }

  // Get visible page text (first ~3000 chars for AI summarization)
  const body = document.body?.innerText || ''
  const pageText = body.slice(0, 3000)

  return {
    title: document.title,
    description: getMeta('description'),
    ogDescription: getMeta('og:description'),
    ogImage: getMeta('og:image'),
    url: window.location.href,
    pageText,
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_METADATA') {
    sendResponse(extractMetadata())
  }
  return true // keep channel open for async response
})
