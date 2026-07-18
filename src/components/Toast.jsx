import React from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { cn } from '../lib/utils.js'

// 画面右下のトースト通知
export default function Toast() {
  const { toast } = useApp()
  if (!toast) return null

  const isError = toast.type === 'error'
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg',
          isError
            ? 'border-destructive/20 bg-red-50 text-destructive'
            : 'border-success/20 bg-green-50 text-success'
        )}
      >
        {isError ? (
          <AlertCircle className="h-5 w-5" />
        ) : (
          <CheckCircle2 className="h-5 w-5" />
        )}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  )
}
