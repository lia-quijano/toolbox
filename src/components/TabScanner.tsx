import { useState, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { db, type Tool, cleanToolName, detectCategory, detectSubcategory, detectPricing } from '../db'
import { CheckSquare, Square, MinusSquare, Loader2 } from 'lucide-react'

const SKIP_PATTERNS = [
  'chrome://', 'chrome-extension://', 'about:', 'edge://',
  'mail.google.com', 'calendar.google.com', 'docs.google.com',
  'drive.google.com', 'meet.google.com', 'accounts.google.com',
  'myaccount.google.com', 'google.com/search',
  'youtube.com/watch', 'netflix.com', 'twitter.com/home',
  'x.com/home', 'facebook.com', 'instagram.com',
  'linkedin.com/feed', 'reddit.com',
  'localhost', '127.0.0.1',
]

interface ScannedTab {
  tabId: number
  url: string
  title: string
  description: string
  ogImage: string
  favicon: string
  category: string
  subcategory: string
  pricing: Tool['pricingModel']
  alreadySaved: boolean
}

interface TabScannerProps {
  onDone: (savedUrls: string[]) => void
  onStateChange: (count: number, saving: boolean) => void
}

export interface TabScannerHandle {
  save: () => Promise<void>
}

export const TabScanner = forwardRef<TabScannerHandle, TabScannerProps>(
  function TabScanner({ onDone, onStateChange }, ref) {
    const [tabs, setTabs] = useState<ScannedTab[]>([])
    const [exitingUrls, setExitingUrls] = useState<Set<string>>(new Set())
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
    const [scanning, setScanning] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savedCount, setSavedCount] = useState(0)
    const hasScannedOnce = useRef(false)
    const userTouchedUrls = useRef(new Set<string>())
    const prevUrlsRef = useRef(new Set<string>()) // URLs the user has manually toggled
    const stateChangeRef = useRef(onStateChange)
    stateChangeRef.current = onStateChange

    useEffect(() => {
      scanTabs()

      // Re-scan when tabs open or close
      const listener = (message: { type: string }) => {
        if (message.type === 'TABS_CHANGED') {
          scanTabs()
        }
      }
      chrome.runtime?.onMessage?.addListener(listener)
      return () => chrome.runtime?.onMessage?.removeListener(listener)
    }, [])

    const unsavedTabs = tabs.filter((t) => !t.alreadySaved)
    const savedTabs = tabs.filter((t) => t.alreadySaved)
    const selectedCount = unsavedTabs.filter((t) => selectedUrls.has(t.url)).length
    const allSelected = unsavedTabs.length > 0 && selectedCount === unsavedTabs.length

    // Notify parent of count changes via ref (no useEffect loop)
    useEffect(() => {
      stateChangeRef.current(selectedCount, saving)
    }, [selectedCount, saving])

    async function scanTabs() {
      if (typeof chrome === 'undefined' || !chrome.tabs) { setScanning(false); return }

      const allTabs = await chrome.tabs.query({})
      const existingUrls = new Set((await db.tools.toArray()).map((t) => t.url))
      const scanned: ScannedTab[] = []

      // Build initial list — deduplicate by URL
      const candidates: chrome.tabs.Tab[] = []
      const seenUrls = new Set<string>()
      for (const tab of allTabs) {
        if (!tab.url || !tab.title) continue
        if (SKIP_PATTERNS.some((p) => tab.url!.includes(p))) continue
        if (seenUrls.has(tab.url)) continue
        seenUrls.add(tab.url)
        candidates.push(tab)
      }

      // Extract metadata from all tabs in parallel
      const metadataResults = await Promise.allSettled(
        candidates.map(async (tab) => {
          if (!tab.id) return { description: '', ogImage: '', pageText: '' }
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const getMeta = (n: string) => {
                  const el = document.querySelector(`meta[name="${n}"]`) || document.querySelector(`meta[property="${n}"]`)
                  return el?.getAttribute('content')?.trim() || ''
                }
                return {
                  description: getMeta('og:description') || getMeta('description'),
                  ogImage: getMeta('og:image'),
                  pageText: (document.body?.innerText || '').slice(0, 1500),
                }
              },
            })
            return results?.[0]?.result as { description: string; ogImage: string; pageText: string } || { description: '', ogImage: '', pageText: '' }
          } catch {
            return { description: '', ogImage: '', pageText: '' }
          }
        })
      )

      for (let i = 0; i < candidates.length; i++) {
        const tab = candidates[i]
        const r = metadataResults[i]
        const meta = r.status === 'fulfilled' ? r.value : { description: '', ogImage: '', pageText: '' }

        const allText = [tab.title, meta.description, meta.pageText].filter(Boolean).join(' ')
        const category = detectCategory(allText, tab.url!)
        const subcategory = detectSubcategory(allText, tab.url!, category)
        const pricing = detectPricing(allText, tab.url!)

        let favicon = ''
        try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(tab.url!).hostname}&sz=32` } catch { /* */ }

        scanned.push({
          tabId: tab.id || 0, url: tab.url!, title: tab.title!,
          description: meta.description, ogImage: meta.ogImage,
          favicon, category, subcategory, pricing,
          alreadySaved: existingUrls.has(tab.url!),
        })
      }

      // Detect removed tabs for exit animation
      const newUrls = new Set(scanned.map((t) => t.url))
      const removed = new Set([...prevUrlsRef.current].filter((url) => !newUrls.has(url)))

      if (removed.size > 0 && hasScannedOnce.current) {
        // Show exit animation, then remove after delay
        setExitingUrls(removed)
        setTimeout(() => {
          setExitingUrls(new Set())
          setTabs(scanned)
        }, 250)
      } else {
        setTabs(scanned)
      }

      prevUrlsRef.current = newUrls

      if (!hasScannedOnce.current) {
        // First scan — select all unsaved
        hasScannedOnce.current = true
        setSelectedUrls(new Set(scanned.filter((t) => !t.alreadySaved).map((t) => t.url)))
      } else {
        // Re-scan — only auto-select new URLs the user hasn't touched
        setSelectedUrls((prev) => {
          const currentUnsavedUrls = new Set(scanned.filter((t) => !t.alreadySaved).map((t) => t.url))

          // Start with previous selections that still exist
          const next = new Set([...prev].filter((url) => currentUnsavedUrls.has(url)))

          // Auto-select new URLs ONLY if the user hasn't manually toggled them
          for (const url of currentUnsavedUrls) {
            if (!userTouchedUrls.current.has(url) && !prev.has(url)) {
              next.add(url)
            }
          }

          return next
        })
      }
      setScanning(false)
    }

    const toggleSelect = (url: string) => {
      userTouchedUrls.current.add(url)
      setSelectedUrls((prev) => {
        const next = new Set(prev)
        if (next.has(url)) next.delete(url); else next.add(url)
        return next
      })
    }

    const toggleSelectAll = () => {
      // Mark all as user-touched
      for (const t of unsavedTabs) userTouchedUrls.current.add(t.url)
      if (allSelected) {
        setSelectedUrls(new Set())
      } else {
        setSelectedUrls(new Set(unsavedTabs.map((t) => t.url)))
      }
    }

    const handleSave = async () => {
      setSaving(true)
      const toSave = unsavedTabs.filter((t) => selectedUrls.has(t.url))

      const tools: Tool[] = toSave.map((t) => ({
        name: cleanToolName(t.title, t.url),
        url: t.url,
        description: t.description,
        favicon: t.favicon,
        ogImage: t.ogImage,
        source: 'manual' as const,
        category: t.category,
        subcategory: t.subcategory,
        tags: [],
        pricingModel: t.pricing,
        note: '',
        rating: null,
        savedAt: new Date().toISOString(),
        metadata: {},
      }))

      await db.tools.bulkAdd(tools)
      const savedUrls = tools.map((t) => t.url)
      setSavedCount(tools.length)
      setSaving(false)
      setTimeout(() => onDone(savedUrls), 1500)
    }

    const handleSaveRef = useRef(handleSave)
    handleSaveRef.current = handleSave
    useImperativeHandle(ref, () => ({ save: () => handleSaveRef.current() }))

    if (scanning) {
      return (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Scanning open tabs...
        </div>
      )
    }

    if (savedCount > 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mb-3" />
          <p className="text-gray-900 font-medium">
            Saving {savedCount} {savedCount === 1 ? 'tool' : 'tools'} to your toolbox
          </p>
        </div>
      )
    }

    return (
      <div>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center gap-2 pl-5 pr-4 py-2.5 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
          {unsavedTabs.length > 0 ? (
            <>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                ) : selectedCount > 0 ? (
                  <MinusSquare className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <div className="flex-1" />
              <span className="text-xs text-gray-400">
                {unsavedTabs.length} new · {savedTabs.length} saved
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-400">No new tabs to save</span>
              <div className="flex-1" />
              {savedTabs.length > 0 && (
                <span className="text-xs text-gray-400">{savedTabs.length} already saved</span>
              )}
            </>
          )}
        </div>

        {/* Unsaved tabs */}
        {unsavedTabs.length > 0 && (
          <ul>
            {unsavedTabs.map((tab) => {
              const isSelected = selectedUrls.has(tab.url)
              const isExiting = exitingUrls.has(tab.url)
              return (
                <li
                  key={tab.url}
                  onClick={() => !isExiting && toggleSelect(tab.url)}
                  className={`px-4 py-3 cursor-pointer select-bg border-b border-gray-50 ${
                    isExiting ? 'item-exit' : 'item-enter'
                  } ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <button className="flex-shrink-0 p-2 -m-1 checkbox-transition" onClick={(e) => { e.stopPropagation(); toggleSelect(tab.url) }}>
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300" />
                      )}
                    </button>
                    <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{cleanToolName(tab.title, tab.url)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{tab.category}</span>
                        {tab.subcategory !== 'General' && tab.subcategory !== 'Uncategorised' && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{tab.subcategory}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Already saved */}
        {savedTabs.length > 0 && (
          <>
            <div className="px-4 py-1.5 mt-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Already saved</p>
            </div>
            <ul className="divide-y divide-gray-50 opacity-50">
              {savedTabs.map((tab) => (
                <li key={tab.url} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex-shrink-0" />
                    <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <p className="text-sm text-gray-500 truncate flex-1">{cleanToolName(tab.title, tab.url)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {tabs.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No open tabs to scan.
          </div>
        )}
      </div>
    )
  }
)
