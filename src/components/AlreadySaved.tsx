import { db, type Tool, briefDescription } from '../db'
import { Pencil, Trash2 } from 'lucide-react'

interface AlreadySavedProps {
  tool: Tool
  onEdit: (tool: Tool) => void
}

export function AlreadySaved({ tool, onEdit }: AlreadySavedProps) {
  const handleDelete = async () => {
    if (tool.id) await db.tools.delete(tool.id)
  }

  const savedDate = new Date(tool.savedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="px-4 py-5">
      <p className="text-xs text-gray-400 mb-3">Saved on {savedDate}</p>

      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2.5">
          <img
            src={tool.favicon}
            alt=""
            className="w-7 h-7 rounded"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="flex-1 min-w-0">
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block transition-colors"
            >
              {tool.name}
            </a>
            {tool.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{briefDescription(tool.description)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{tool.category}</span>
          {tool.subcategory && tool.subcategory !== 'General' && tool.subcategory !== 'Uncategorised' && (
            <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">{tool.subcategory}</span>
          )}
          <span className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded">
            {tool.pricingModel === 'open-source' ? 'OSS' : tool.pricingModel.charAt(0).toUpperCase() + tool.pricingModel.slice(1)}
          </span>
          {tool.tags.map((tag) => (
            <span key={tag} className="text-xs text-gray-400">#{tag}</span>
          ))}
        </div>

        {tool.note && <p className="text-xs text-gray-500 italic">{tool.note}</p>}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={() => onEdit(tool)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      </div>
    </div>
  )
}
