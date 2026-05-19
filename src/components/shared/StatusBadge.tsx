type StatusTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'violet'
  | 'danger'
  | 'neutral'

type StatusBadgeProps = {
  label: string
  tone?: StatusTone
}

const toneStyles: Record<StatusTone, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  info:
    'border-sky-200 bg-sky-50 text-sky-800',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900',
  violet:
    'border-violet-200 bg-violet-50 text-violet-800',
  danger:
    'border-red-200 bg-red-50 text-red-800',
  neutral:
    'border-zinc-200 bg-zinc-100 text-zinc-700',
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-tight ${toneStyles[tone]}`}
    >
      {label}
    </span>
  )
}