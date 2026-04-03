import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Tool } from '../db'
import { Trash2, Inbox, Square, CheckSquare, MinusSquare, ExternalLink } from 'lucide-react'

interface ToolListProps {
  category: string | null
  onEdit: (tool: Tool) => void
  onDeleteTools: (tools: Tool[]) => void
  highlightUrls?: Set<string>
}

export function ToolList({ category, onEdit, onDeleteTools, highlightUrls }: ToolListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set())

  const tools = useLiveQuery(() => {
    if (category) {
      return db.tools.where('category').equals(category).reverse().sortBy('savedAt')
    }
    return db.tools.orderBy('savedAt').reverse().toArray()
  }, [category])

  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!tools) return
    const allIds = new Set(tools.map((t) => t.id!).filter(Boolean))
    if (selectedIds.size === allIds.size) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(allIds)
    }
  }

  const handleBulkDelete = () => {
    if (!tools) return
    const toDelete = tools.filter((t) => t.id && selectedIds.has(t.id))
    if (toDelete.length === 0) return

    // Animate out, then delete
    const ids = new Set(toDelete.map((t) => t.id!))
    setExitingIds(ids)
    setTimeout(() => {
      onDeleteTools(toDelete)
      setExitingIds(new Set())
      setSelectedIds(new Set())
    }, 300)
  }

  if (!tools || tools.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-gray-400">
        <Inbox className="w-6 h-6 mx-auto mb-2 opacity-50" />
        {category ? `No ${category} tools saved yet.` : 'No tools saved yet.'}
      </div>
    )
  }

  const hasSelection = selectedIds.size > 0
  const allSelected = selectedIds.size === tools.length

  const toolbar = (
    <div className="sticky top-0 z-10 flex items-center gap-2 pl-5 pr-4 py-2.5 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
      {/* Select all — left side, checkbox first */}
      <button
        onClick={toggleSelectAll}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {allSelected ? (
          <CheckSquare className="w-5 h-5 text-indigo-600" />
        ) : hasSelection ? (
          <MinusSquare className="w-5 h-5 text-indigo-400" />
        ) : (
          <Square className="w-5 h-5" />
        )}
        {allSelected ? 'Deselect all' : 'Select all'}
      </button>

      <div className="flex-1" />

      {/* Selection actions — right side */}
      <span className={`text-xs text-gray-500 ${hasSelection ? 'visible' : 'invisible'}`}>
        {selectedIds.size} selected
      </span>
      <button
        onClick={handleBulkDelete}
        className={`flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors ${hasSelection ? 'visible' : 'invisible'}`}
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
    </div>
  )

  if (category) {
    const grouped: Record<string, Tool[]> = {}
    for (const tool of tools) {
      const sub = tool.subcategory || 'General'
      if (!grouped[sub]) grouped[sub] = []
      grouped[sub].push(tool)
    }

    return (
      <div>
        {toolbar}
        <div className="py-1">
          {Object.entries(grouped).map(([subcat, subTools]) => (
            <div key={subcat}>
              <div className="px-4 py-1.5">
                <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  {subcat}
                </h3>
              </div>
              <ul className="divide-y divide-gray-50">
                {subTools.map((tool) => (
                  <ToolRow
                    key={tool.id}
                    tool={tool}
                    onEdit={onEdit}
                    selected={!!tool.id && selectedIds.has(tool.id)}
                    onToggleSelect={(e) => tool.id && toggleSelect(e, tool.id)}
                    hideCategory
                    highlight={highlightUrls?.has(tool.url)}
                    exiting={!!tool.id && exitingIds.has(tool.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {toolbar}
      <ul className="divide-y divide-gray-50">
        {tools.map((tool) => (
          <ToolRow
            key={tool.id}
            tool={tool}
            onEdit={onEdit}
            selected={!!tool.id && selectedIds.has(tool.id)}
            onToggleSelect={(e) => tool.id && toggleSelect(e, tool.id)}
            highlight={highlightUrls?.has(tool.url)}
            exiting={!!tool.id && exitingIds.has(tool.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function ToolRow({
  tool,
  onEdit,
  selected,
  onToggleSelect,
  hideCategory,
  highlight,
  exiting,
}: {
  tool: Tool
  onEdit: (tool: Tool) => void
  selected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  hideCategory?: boolean
  highlight?: boolean
  exiting?: boolean
}) {
  const [previewStyle, setPreviewStyle] = useState<React.CSSProperties | null>(null)
  const [liveOgImage, setLiveOgImage] = useState<string | null>(null)
  const rowRef = useRef<HTMLLIElement>(null)
  const fetchedRef = useRef(false)

  let hostname = ''
  try { hostname = new URL(tool.url).hostname } catch { /* */ }

  // On hover, if no ogImage stored, try to fetch it live
  const handleMouseEnter = () => {
    if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect()
      const previewWidth = 224 // w-56 = 14rem = 224px
      const centreLeft = rect.left + (rect.width / 2) - (previewWidth / 2)
      setPreviewStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: Math.max(4, centreLeft),
        zIndex: 9999,
      })
    }

    if (!tool.ogImage && !liveOgImage && !fetchedRef.current) {
      fetchedRef.current = true
      fetchOgImage(tool.url).then((img) => {
        if (img) {
          setLiveOgImage(img)
          // Also persist it for future
          if (tool.id) db.tools.update(tool.id, { ogImage: img })
        }
      })
    }
  }

  const previewImage = tool.ogImage || liveOgImage

  return (
    <li
      ref={rowRef}
      className={`group relative px-4 py-3 cursor-pointer select-bg ${
        exiting ? 'item-exit' : highlight ? 'animate-glow' : selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setPreviewStyle(null)}
      onClick={() => onEdit(tool)}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox — left side */}
        <button
          onClick={onToggleSelect}
          className="flex-shrink-0 p-2 -m-1 checkbox-transition"
        >
          {selected ? (
            <CheckSquare className="w-5 h-5 text-indigo-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Name with favicon */}
          <div className="flex items-center gap-1.5">
            <img
              src={tool.favicon}
              alt=""
              className="w-4 h-4 rounded-sm flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <p className="text-sm font-medium text-gray-900 truncate">
              {tool.name}
            </p>
          </div>
          <TagRow tool={tool} hideCategory={hideCategory} />
          {/* URL */}
          {hostname && (
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-indigo-600 truncate mt-2 transition-colors"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              {hostname}
            </a>
          )}
        </div>
      </div>

      {/* Hover preview — portaled into #root to escape all clipping */}
      {previewStyle && createPortal(
        <div
          className="preview-card w-52 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden pointer-events-none"
          style={previewStyle}
        >
          {previewImage && (
            <img
              src={previewImage}
              alt=""
              className="w-full object-contain bg-gray-50 max-h-32"
              onLoad={(e) => (e.target as HTMLImageElement).classList.add('loaded')}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <div className="p-2.5">
            <p className="text-xs font-medium text-gray-900 truncate">{tool.name}</p>
            {tool.description && (
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{tool.description}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-1.5 truncate">{hostname}</p>
          </div>
        </div>,
        document.getElementById('root')!
      )}
    </li>
  )
}

/** Get a preview image URL — tries og:image from open tab, falls back to microlink screenshot */
async function fetchOgImage(url: string): Promise<string | null> {
  // Try scripting API if the page is open in a tab
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const tabs = await chrome.tabs.query({})
      const matchingTab = tabs.find((t) => t.url === url)
      if (matchingTab?.id) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: matchingTab.id },
          func: () => {
            const el =
              document.querySelector('meta[property="og:image"]') ||
              document.querySelector('meta[name="og:image"]')
            return el?.getAttribute('content')?.trim() || ''
          },
        })
        const img = results?.[0]?.result as string | undefined
        if (img) return img
      }
    } catch {
      // Can't access
    }
  }

  // Microlink embed URL serves the screenshot directly as an image
  // No fetch needed — just construct the URL and use it as img src
  const encoded = encodeURIComponent(url)
  return `https://api.microlink.io/?url=${encoded}&screenshot=true&meta=false&embed=screenshot.url`
}

function TagRow({ tool, hideCategory }: { tool: Tool; hideCategory?: boolean }) {
  const allTags: { label: string; className: string }[] = []

  if (!hideCategory) {
    allTags.push({ label: tool.category, className: 'text-indigo-600 bg-indigo-50' })
  }
  if (tool.subcategory && tool.subcategory !== 'General' && tool.subcategory !== 'Uncategorised') {
    allTags.push({ label: tool.subcategory, className: 'text-gray-500 bg-gray-100' })
  }
  if (tool.pricingModel !== 'unknown') {
    allTags.push({
      label: tool.pricingModel === 'open-source' ? 'OSS' : tool.pricingModel.charAt(0).toUpperCase() + tool.pricingModel.slice(1),
      className: 'text-gray-400 bg-gray-50',
    })
  }
  for (const tag of tool.tags) {
    allTags.push({ label: `#${tag}`, className: 'text-gray-400 bg-transparent' })
  }

  const visible = allTags.slice(0, 3)
  const overflow = allTags.length - 3

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      {visible.map((t, i) => (
        <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${t.className}`}>
          {t.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-50">
          +{overflow}
        </span>
      )}
    </div>
  )
}
