import { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { SaveForm } from './components/SaveForm'
import { ToolList } from './components/ToolList'
import { AlreadySaved } from './components/AlreadySaved'
import { Sidebar } from './components/Sidebar'
import { UndoToast } from './components/UndoToast'
import { ChevronLeft } from 'lucide-react'
import { TabScanner } from './components/TabScanner'
import { db, CATEGORIES, type Tool } from './db'

type View = 'save' | 'browse' | 'scan'

interface PendingDeletion {
  tools: Tool[]
  timeoutId: ReturnType<typeof setTimeout>
}

export default function App() {
  const [view, setView] = useState<View>('save')
  const [justSavedUrl, setJustSavedUrl] = useState<string | null>(null)
  const [highlightUrls, setHighlightUrls] = useState<Set<string>>(new Set())
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const formRef = useRef<{ save: () => Promise<void> } | null>(null)
  const scanRef = useRef<{ save: () => Promise<void> } | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [scanSaving, setScanSaving] = useState(false)

  const [tabKey, setTabKey] = useState(0)

  // Get current tab URL + listen for tab changes
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return

    // Initial query
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0]?.url) setCurrentUrl(tabs[0].url)
    })

    // Listen for tab change messages from background script
    let debounceTimer: ReturnType<typeof setTimeout>
    const listener = (message: { type: string; url?: string }) => {
      if (message.type === 'TAB_CHANGED' && message.url) {
        // Debounce — onUpdated fires multiple times per navigation
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          setCurrentUrl(message.url!)
          setJustSavedUrl(null)
          setTabKey((k) => k + 1)
        }, 300)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      clearTimeout(debounceTimer)
    }
  }, [])

  // Check if this URL is already saved
  const existingTool = useLiveQuery(
    () => currentUrl ? db.tools.where('url').equals(currentUrl).first() : undefined,
    [currentUrl]
  )

  // Category counts for sidebar
  const categoryCounts = useLiveQuery(async () => {
    const counts: Record<string, number> = {}
    const all = await db.tools.toArray()
    for (const t of all) {
      counts[t.category] = (counts[t.category] || 0) + 1
    }
    return counts
  }, [])

  const totalCount = categoryCounts
    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    : 0

  const showSavedCard = view === 'save' && !!existingTool && !editingTool && justSavedUrl !== currentUrl

  const handleSaved = (category?: string) => {
    const savedUrl = editingTool?.url || currentUrl
    setJustSavedUrl(currentUrl)
    setHighlightUrls(new Set([savedUrl]))
    setEditingTool(null)
    if (category) setSelectedCategory(category)
    setTimeout(() => setHighlightUrls(new Set()), 3000)
    setView('browse')
  }

  const handleEdit = (tool: Tool) => {
    setJustSavedUrl(null)
    setEditingTool(tool)
    setView('save')
  }

  const handleSaveClick = async () => {
    formRef.current?.save()
  }

  const handleDeleteTools = useCallback(async (tools: Tool[]) => {
    if (pendingDeletion) {
      clearTimeout(pendingDeletion.timeoutId)
      setPendingDeletion(null)
    }

    const ids = tools.map((t) => t.id!).filter(Boolean)
    await db.tools.bulkDelete(ids)

    if (editingTool && ids.includes(editingTool.id!)) {
      setEditingTool(null)
      setView('browse')
    }

    const timeoutId = setTimeout(() => {
      setPendingDeletion(null)
    }, 5000)

    setPendingDeletion({ tools, timeoutId })
  }, [pendingDeletion, editingTool])

  const handleUndo = useCallback(async () => {
    if (!pendingDeletion) return
    clearTimeout(pendingDeletion.timeoutId)
    const toRestore = pendingDeletion.tools.map((t) => {
      const { id: _, ...rest } = t
      return rest
    })
    await db.tools.bulkAdd(toRestore as Tool[])
    setPendingDeletion(null)
  }, [pendingDeletion])

  const handleDismissUndo = useCallback(() => {
    if (pendingDeletion) {
      clearTimeout(pendingDeletion.timeoutId)
      setPendingDeletion(null)
    }
  }, [pendingDeletion])

  const handleDeleteSingle = async (tool: Tool) => {
    await handleDeleteTools([tool])
  }

  const handleNewSave = () => {
    setEditingTool(null)
    setJustSavedUrl(null)
    setTabKey((k) => k + 1) // remount SaveForm to re-fetch from current tab
    setView('save')
  }

  const handleScanCountChange = useCallback((count: number, isSaving: boolean) => {
    setScanCount(count)
    setScanSaving(isSaving)
  }, [])

  const handleBack = () => {
    setSelectedCategory(null)
    setView('browse')
  }

  const isEditing = !!editingTool
  const ctaLabel = saving ? 'Saving...' : isEditing ? 'Update' : 'Save'

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <Sidebar
        categories={CATEGORIES}
        categoryCounts={categoryCounts || {}}
        totalCount={totalCount}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat)
          setView('browse')
        }}
        onShowAll={() => {
          setSelectedCategory(null)
          setView('browse')
        }}
        onAddTool={handleNewSave}
        onScanTabs={() => setView('scan')}
        activeView={view}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-4 h-12">
            {view === 'save' ? (
              <>
                <div className="flex items-center gap-1">
                  {(isEditing || showSavedCard) && (
                    <button
                      onClick={() => { setEditingTool(null); setView('browse') }}
                      className="p-1 -ml-1 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h1 className="text-sm font-semibold text-gray-900">
                    {isEditing ? 'Edit Tool' : showSavedCard ? 'Saved' : 'Save Tool'}
                  </h1>
                </div>
                {!showSavedCard && (
                  <div className="flex items-center gap-2">
                    {isEditing && (
                      <button
                        onClick={() => { setEditingTool(null); setView('browse') }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSaveClick}
                      disabled={saving}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {ctaLabel}
                    </button>
                  </div>
                )}
              </>
            ) : view === 'scan' ? (
              <>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setView('browse')}
                    className="p-1 -ml-1 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-sm font-semibold text-gray-900">Scan open tabs</h1>
                </div>
                <button
                  onClick={() => scanRef.current?.save()}
                  disabled={scanSaving || scanCount === 0}
                  className={`px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all ${scanCount === 0 ? 'invisible' : ''}`}
                >
                  {scanSaving ? 'Saving...' : `Add ${scanCount} ${scanCount === 1 ? 'tool' : 'tools'}`}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  {selectedCategory && (
                    <button
                      onClick={handleBack}
                      className="p-1 -ml-1 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h1 className="text-sm font-semibold text-gray-900">
                    {selectedCategory || 'All Tools'}
                    {categoryCounts && (
                      <span className="ml-1.5 text-[10px] text-gray-500 font-normal bg-gray-100 px-1.5 py-0.5 rounded-full tabular-nums">
                        {selectedCategory ? categoryCounts[selectedCategory] || 0 : totalCount}
                      </span>
                    )}
                  </h1>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'save' ? (
            showSavedCard && existingTool ? (
              <AlreadySaved tool={existingTool} onEdit={handleEdit} />
            ) : (
              <SaveForm
                key={editingTool ? `edit-${editingTool.id}` : `tab-${tabKey}`}
                ref={formRef}
                onSaved={handleSaved}
                onSavingChange={setSaving}
                editingTool={editingTool}
                onCancelEdit={() => { setEditingTool(null); setView('browse') }}
                onDelete={handleDeleteSingle}
              />
            )
          ) : view === 'scan' ? (
            <TabScanner
              ref={scanRef}
              onDone={(savedUrls) => {
                setSelectedCategory(null)
                setHighlightUrls(new Set(savedUrls))
                setTimeout(() => setHighlightUrls(new Set()), 3000)
                setView('browse')
              }}
              onStateChange={handleScanCountChange}
            />
          ) : (
            <ToolList
              category={selectedCategory}
              onEdit={handleEdit}
              onDeleteTools={handleDeleteTools}
              highlightUrls={highlightUrls}
            />
          )}
        </div>

        {pendingDeletion && (
          <UndoToast
            count={pendingDeletion.tools.length}
            onUndo={handleUndo}
            onDismiss={handleDismissUndo}
          />
        )}
      </div>
    </div>
  )
}
