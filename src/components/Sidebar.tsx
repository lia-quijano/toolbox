import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Layers, Paintbrush, Sparkles, Code, Blocks, TrendingUp,
  Zap, Film, ShoppingBag, Rocket, CircleDot, Plus,
  PanelLeftClose, PanelLeftOpen, Download, Upload, ScanSearch,
} from 'lucide-react'
import { CATEGORY_GROUPS } from '../db'
import { exportAsHtmlBookmarks, importFromHtmlBookmarks } from '../export'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Design': <Paintbrush className="w-4 h-4" />,
  'Dev Tools': <Code className="w-4 h-4" />,
  'No-Code': <Blocks className="w-4 h-4" />,
  'AI': <Sparkles className="w-4 h-4" />,
  'Marketing': <TrendingUp className="w-4 h-4" />,
  'Productivity': <Zap className="w-4 h-4" />,
  'Media': <Film className="w-4 h-4" />,
  'Commerce': <ShoppingBag className="w-4 h-4" />,
  'Startup': <Rocket className="w-4 h-4" />,
  'Other': <CircleDot className="w-4 h-4" />,
}

interface SidebarProps {
  categories: string[]
  categoryCounts: Record<string, number>
  totalCount: number
  selectedCategory: string | null
  onSelectCategory: (cat: string) => void
  onShowAll: () => void
  onAddTool: () => void
  onScanTabs: () => void
  activeView: 'save' | 'browse' | 'scan'
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({
  categoryCounts,
  totalCount,
  selectedCategory,
  onSelectCategory,
  onShowAll,
  onAddTool,
  onScanTabs,
  activeView,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <div
      className={`flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col h-full transition-all duration-200 ${
        collapsed ? 'w-11' : 'w-44'
      }`}
    >
      {/* Toggle */}
      <div className={`flex items-center border-b border-gray-100 ${collapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2.5'}`}>
        {!collapsed && (
          <span className="text-xs font-bold text-gray-900 tracking-tight">Toolbox</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Actions */}
      <div className={`border-b border-gray-100 ${collapsed ? 'px-1.5 py-1.5 space-y-0.5' : 'px-2 py-1.5 space-y-0.5'}`}>
        <NavItem
          icon={<Plus className="w-4 h-4" />}
          label="Add tool"
          count={0}
          active={activeView === 'save'}
          collapsed={collapsed}
          onClick={onAddTool}
        />
        <NavItem
          icon={<ScanSearch className="w-4 h-4" />}
          label="Scan tabs"
          count={0}
          active={activeView === 'scan'}
          collapsed={collapsed}
          onClick={onScanTabs}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {/* All */}
        <NavItem
          icon={<Layers className="w-4 h-4" />}
          label="All"
          count={totalCount}
          active={activeView === 'browse' && selectedCategory === null}
          collapsed={collapsed}
          onClick={onShowAll}
        />

        {/* Grouped categories */}
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <div className="h-px bg-gray-100 my-1.5" />
            ) : (
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-3 mb-1 px-2">
                {group.label}
              </p>
            )}
            {group.categories.map((cat) => (
              <NavItem
                key={cat}
                icon={CATEGORY_ICONS[cat] || <CircleDot className="w-4 h-4" />}
                label={cat}
                count={categoryCounts[cat] || 0}
                active={activeView === 'browse' && selectedCategory === cat}
                collapsed={collapsed}
                onClick={() => onSelectCategory(cat)}
              />
            ))}
          </div>
        ))}

        {/* Other */}
        {collapsed ? (
          <div className="h-px bg-gray-100 my-1.5" />
        ) : (
          <div className="h-px bg-gray-100 my-1.5" />
        )}
        <NavItem
          icon={<CircleDot className="w-4 h-4" />}
          label="Other"
          count={categoryCounts['Other'] || 0}
          active={activeView === 'browse' && selectedCategory === 'Other'}
          collapsed={collapsed}
          onClick={() => onSelectCategory('Other')}
        />

        <div className="h-px bg-gray-100 my-1.5" />

        {/* Import / Export */}
        <NavItem
          icon={<Upload className="w-4 h-4" />}
          label="Import"
          count={0}
          active={false}
          collapsed={collapsed}
          onClick={async () => {
            const count = await importFromHtmlBookmarks()
            if (count > 0) onShowAll()
          }}
        />
        <NavItem
          icon={<Download className="w-4 h-4" />}
          label="Export"
          count={0}
          active={false}
          collapsed={collapsed}
          onClick={exportAsHtmlBookmarks}
        />
      </nav>
    </div>
  )
}

function NavItem({
  icon,
  label,
  count,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (hovered && collapsed && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      })
    }
  }, [hovered, collapsed])

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`w-full flex items-center rounded-md transition-colors ${
          collapsed
            ? `justify-center p-1.5 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`
            : `gap-2 px-2 py-1.5 text-xs ${active ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`
        }`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{label}</span>
            {count > 0 && <span className="text-[10px] text-gray-400 tabular-nums ml-auto">{count}</span>}
          </>
        )}
      </button>

      {collapsed && hovered && createPortal(
        <div
          className="fixed z-[9999] px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap pointer-events-none"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-50%)',
          }}
        >
          {label}
          {count > 0 && <span className="ml-2 px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[10px] rounded-full tabular-nums">{count}</span>}
        </div>,
        document.body
      )}
    </>
  )
}
