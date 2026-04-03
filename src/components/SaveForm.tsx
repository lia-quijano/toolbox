import { useState, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import {
  db, CATEGORIES, PRICING_MODELS,
  detectCategory, detectSubcategory, detectPricing, cleanToolName,
  getSubcategories,
  type Tool,
} from '../db'
import { X, Sparkles, Loader2, Plus, Trash2 } from 'lucide-react'

interface PageMetadata {
  title: string
  description: string
  ogDescription: string
  ogImage: string
  url: string
  pageText: string
}

interface SaveFormProps {
  onSaved: (category: string) => void
  onSavingChange: (saving: boolean) => void
  editingTool?: Tool | null
  onCancelEdit?: () => void
  onDelete?: (tool: Tool) => void
}

export interface SaveFormHandle {
  save: () => Promise<void>
}

export const SaveForm = forwardRef<SaveFormHandle, SaveFormProps>(
  function SaveForm({ onSaved, onSavingChange, editingTool, onDelete }, ref) {
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('Other')
    const [subcategory, setSubcategory] = useState('Uncategorised')
    const [pricingModel, setPricingModel] = useState<Tool['pricingModel']>('unknown')
    const [tags, setTags] = useState<string[]>([])
    const [note, setNote] = useState('')
    const [, setSaving] = useState(false)
    const [summarizing, setSummarizing] = useState(false)
    const [aiAvailable, setAiAvailable] = useState(false)
    const [pageText, setPageText] = useState('')
    const [ogImage, setOgImage] = useState('')
    const [showCustomTagInput, setShowCustomTagInput] = useState(false)
    const [customTagValue, setCustomTagValue] = useState('')

    const isEditing = !!editingTool
    const subcategories = getSubcategories(category)

    // When category changes, reset subcategory if it doesn't belong
    useEffect(() => {
      if (!subcategories.includes(subcategory)) {
        setSubcategory(subcategories[0])
      }
    }, [category, subcategories, subcategory])

    // Populate form when editing
    useEffect(() => {
      if (editingTool) {
        setName(editingTool.name)
        setUrl(editingTool.url)
        setDescription(editingTool.description)
        setCategory(editingTool.category)
        setSubcategory(editingTool.subcategory || 'Other')
        setPricingModel(editingTool.pricingModel)
        setTags(editingTool.tags)
        setNote(editingTool.note)
        setPageText('')
      }
    }, [editingTool])

    // Check if Chrome AI is available
    useEffect(() => {
      async function checkAI() {
        try {
          if (window.ai?.summarizer) {
            const caps = await window.ai.summarizer.capabilities()
            setAiAvailable(caps.available !== 'no')
          }
        } catch {
          // AI not available
        }
      }
      checkAI()
    }, [])

    // Auto-fill from current tab (works in both popup and side panel)
    useEffect(() => {
      if (isEditing) return
      if (typeof chrome === 'undefined' || !chrome.tabs) return

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
        const tab = tabs[0]
        if (!tab?.url) return

        const tabId = tab.id
        setName(cleanToolName(tab.title || '', tab.url))
        setUrl(tab.url || '')

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return
        if (!tabId) return

        const applyMetadata = (meta: { description: string; ogDescription: string; ogImage?: string; pageText: string }) => {
          const desc = meta.ogDescription || meta.description
          if (desc) setDescription(desc)
          if (meta.ogImage) setOgImage(meta.ogImage)
          if (meta.pageText) setPageText(meta.pageText)

          const allText = [tab.title, desc, meta.pageText].filter(Boolean).join(' ')
          const detectedCat = detectCategory(allText, tab.url!)
          setCategory(detectedCat)
          setSubcategory(detectSubcategory(allText, tab.url!, detectedCat))
          setPricingModel(detectPricing(allText, tab.url!))
        }

        // Always do URL-based detection from tab title as a baseline
        const baseText = tab.title || ''
        const baseCat = detectCategory(baseText, tab.url!)
        setCategory(baseCat)
        setSubcategory(detectSubcategory(baseText, tab.url!, baseCat))
        setPricingModel(detectPricing(baseText, tab.url!))

        // Then try to get richer metadata from the page
        // Try scripting API first (more reliable in side panel), then content script
        let gotMetadata = false

        // Method 1: chrome.scripting API
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const getMeta = (n: string) => {
                const el =
                  document.querySelector(`meta[name="${n}"]`) ||
                  document.querySelector(`meta[property="${n}"]`)
                return el?.getAttribute('content')?.trim() || ''
              }
              return {
                description: getMeta('description'),
                ogDescription: getMeta('og:description'),
                ogImage: getMeta('og:image'),
                pageText: (document.body?.innerText || '').slice(0, 3000),
              }
            },
          })
          const result = results?.[0]?.result as {
            description: string; ogDescription: string; ogImage: string; pageText: string
          } | undefined
          if (result) {
            applyMetadata(result)
            gotMetadata = true
          }
        } catch {
          // Scripting API unavailable for this tab
        }

        // Method 2: content script message
        if (!gotMetadata) {
          try {
            const response: PageMetadata = await chrome.tabs.sendMessage(tabId, {
              type: 'GET_PAGE_METADATA',
            })
            if (response) {
              applyMetadata(response)
              gotMetadata = true
            }
          } catch {
            // Content script unavailable for this tab
          }
        }

        // Method 3: fetch the page HTML directly and parse meta tags
        if (!gotMetadata && tab.url) {
          try {
            const resp = await fetch(tab.url)
            if (resp.ok) {
              const html = await resp.text()
              const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
              const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
              const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
              const desc = ogDesc || metaDesc || ''
              if (desc) setDescription(desc)
              if (ogImg) setOgImage(ogImg)

              const allText = [tab.title, desc].filter(Boolean).join(' ')
              const detectedCat = detectCategory(allText, tab.url!)
              setCategory(detectedCat)
              setSubcategory(detectSubcategory(allText, tab.url!, detectedCat))
              setPricingModel(detectPricing(allText, tab.url!))
            }
          } catch {
            // Fetch also failed — that's ok, we have baseline detection
          }
        }
      })
    }, [isEditing])

    const handleSummarize = async () => {
      if (!pageText || !window.ai?.summarizer) return
      setSummarizing(true)
      try {
        const summarizer = await window.ai.summarizer.create({
          type: 'tl;dr',
          length: 'short',
          format: 'plain-text',
          sharedContext: 'Summarize what this tool or product does in one sentence.',
        })
        const summary = await summarizer.summarize(pageText)
        if (summary) setDescription(summary.trim())
        summarizer.destroy()
      } catch {
        // failed
      } finally {
        setSummarizing(false)
      }
    }

    const addTag = (tag: string) => {
      const value = tag.trim().toLowerCase()
      if (value && !tags.includes(value)) {
        setTags([...tags, value])
      }
    }

    const addCustomTag = () => {
      const value = customTagValue.trim().toLowerCase()
      if (value) {
        addTag(value)
        setCustomTagValue('')
        setShowCustomTagInput(false)
      }
    }

    const removeTag = (tag: string) => {
      setTags(tags.filter((t) => t !== tag))
    }

    const resetForm = () => {
      setName('')
      setUrl('')
      setDescription('')
      setCategory('Other')
      setSubcategory('General')
      setPricingModel('unknown')
      setTags([])
      setNote('')
      setPageText('')
      setOgImage('')
      setShowCustomTagInput(false)
      setCustomTagValue('')
    }

    const handleSave = async () => {
      if (!name.trim() || !url.trim()) return

      setSaving(true)
      onSavingChange(true)
      try {
        const toolData = {
          name: name.trim(),
          url: url.trim(),
          description: description.trim(),
          favicon: `https://www.google.com/s2/favicons?domain=${new URL(url.trim()).hostname}&sz=32`,
          ogImage: ogImage || editingTool?.ogImage || '',
          source: detectSource(url),
          category,
          subcategory,
          tags,
          pricingModel,
          note: note.trim(),
          rating: editingTool?.rating ?? null,
          savedAt: editingTool?.savedAt ?? new Date().toISOString(),
          metadata: editingTool?.metadata ?? {},
        }

        if (isEditing && editingTool?.id) {
          await db.tools.update(editingTool.id, toolData)
        } else {
          await db.tools.add(toolData)
        }

        const savedCategory = category
        resetForm()
        onSaved(savedCategory)
      } catch {
        // silently fail
      } finally {
        setSaving(false)
        onSavingChange(false)
      }
    }

    // Use a ref so the imperative handle always calls the latest handleSave
    const handleSaveRef = useRef(handleSave)
    handleSaveRef.current = handleSave
    useImperativeHandle(ref, () => ({ save: () => handleSaveRef.current() }))

    // Subcategories that aren't already chosen as the primary — available as tags
    const subTagSuggestions = subcategories
      .filter((s) => s !== 'Other' && s !== subcategory && !tags.includes(s.toLowerCase()))

    const fieldLabel = "block text-[11px] font-medium text-gray-500 mb-1"

    return (
      <div className="px-4 py-3 space-y-3">
        {/* Name */}
        <div>
          <label className={fieldLabel}>Tool name</label>
          <input
            type="text"
            placeholder="e.g. Figma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* URL */}
        <div>
          <label className={fieldLabel}>URL</label>
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Description + AI button */}
        <div>
          <label className={fieldLabel}>Description</label>
          <div className="relative">
            <textarea
              placeholder="What does this tool do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y min-h-[3.5rem]"
            />
            {aiAvailable && pageText && (
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                title="Summarize with AI"
                className="absolute right-2 top-2 p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {summarizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className={fieldLabel}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        {subcategories.length > 1 && (
          <div>
            <label className={fieldLabel}>Sub-category</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
            >
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pricing */}
        <div>
          <label className={fieldLabel}>Pricing</label>
          <select
            value={pricingModel}
            onChange={(e) => setPricingModel(e.target.value as Tool['pricingModel'])}
            className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          >
            {PRICING_MODELS.map((pm) => (
              <option key={pm} value={pm}>
                {pm === 'open-source' ? 'Open Source' : pm.charAt(0).toUpperCase() + pm.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className={fieldLabel}>Tags</label>
          <div className="flex gap-1.5 flex-wrap">
          {/* Active tags */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Subcategory-based suggestions */}
          {subTagSuggestions.slice(0, 5).map((sub) => (
            <button
              key={sub}
              onClick={() => addTag(sub.toLowerCase())}
              className="px-2 py-0.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
            >
              {sub}
            </button>
          ))}

          {/* Custom tag */}
          {showCustomTagInput ? (
            <span className="inline-flex items-center border border-indigo-300 rounded-full overflow-hidden">
              <input
                type="text"
                value={customTagValue}
                onChange={(e) => setCustomTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addCustomTag() }
                  if (e.key === 'Escape') { setShowCustomTagInput(false); setCustomTagValue('') }
                }}
                autoFocus
                placeholder="tag name"
                className="px-2 py-0.5 text-xs w-20 focus:outline-none bg-transparent"
              />
              <button onClick={addCustomTag} className="px-1.5 py-0.5 text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <button
              onClick={() => setShowCustomTagInput(true)}
              className="px-2 py-0.5 text-xs rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              + Custom tag
            </button>
          )}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className={fieldLabel}>Personal note</label>
          <textarea
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y min-h-[3.5rem]"
        />
        </div>

        {/* Delete — only when editing */}
        {isEditing && editingTool && onDelete && (
          <button
            onClick={() => onDelete(editingTool)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete tool
          </button>
        )}
      </div>
    )
  }
)

function detectSource(url: string): Tool['source'] {
  try {
    const hostname = new URL(url).hostname
    if (hostname.includes('producthunt.com')) return 'producthunt'
    if (hostname.includes('github.com')) return 'github'
    if (hostname.includes('npmjs.com')) return 'npm'
    return 'other'
  } catch {
    return 'manual'
  }
}
