import React from 'react'
import { cn } from '../../lib/utils.js'

// -------------------------------------------------------------
// shadcn 風の軽量 UI コンポーネント集（Tailwind ベース）
// -------------------------------------------------------------

// Button
const buttonVariants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-slate-200',
  outline:
    'border border-slate-200 bg-white hover:bg-slate-50 text-foreground shadow-sm',
  ghost: 'hover:bg-slate-100 text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm',
}
const buttonSizes = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9',
}
export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  )
}

// Card
export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  )
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 p-5', className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  )
}
export function CardDescription({ className, ...props }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

// Input
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

// Textarea
export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

// Select（ネイティブ）
export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// Badge
const badgeVariants = {
  default: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
}
export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

// Checkbox（見た目付き）
export function Checkbox({ checked, onChange, className, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        checked
          ? 'border-primary bg-primary text-white'
          : 'border-slate-300 bg-white hover:border-primary/50',
        className
      )}
    >
      {checked && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="h-4 w-4"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

// Label
export function Label({ className, ...props }) {
  return (
    <label
      className={cn('text-sm font-medium text-slate-700', className)}
      {...props}
    />
  )
}

// Skeleton
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
}

// Modal（簡易ダイアログ）
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl',
          maxWidth
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="閉じる"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
