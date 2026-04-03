import { useEffect, useState } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoToastProps {
  count: number
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ count, onUndo, onDismiss }: UndoToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const duration = 5000

    const tick = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining > 0) requestAnimationFrame(tick)
    }

    const frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const label = count === 1 ? '1 tool deleted' : `${count} tools deleted`

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 toast-enter">
      <div className="bg-gray-900 text-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="text-xs flex-1">{label}</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-300 hover:text-white rounded transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="p-0.5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
