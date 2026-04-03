// Type declarations for Chrome's built-in AI APIs (experimental)
// These are available in Chrome 129+ with the right flags

interface AISummarizerOptions {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline'
  length?: 'short' | 'medium' | 'long'
  format?: 'plain-text' | 'markdown'
  sharedContext?: string
}

interface AISummarizer {
  summarize(text: string, options?: { context?: string }): Promise<string>
  destroy(): void
}

interface AISummarizerFactory {
  capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>
  create(options?: AISummarizerOptions): Promise<AISummarizer>
}

interface AI {
  summarizer?: AISummarizerFactory
}

interface Window {
  ai?: AI
}
