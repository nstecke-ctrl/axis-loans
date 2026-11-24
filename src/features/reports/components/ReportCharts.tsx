import { useRef, useState, type MouseEvent, type ReactNode } from 'react'

// Light-surface chart tokens (validated: categorical slots 1–2 pass all checks).
export const chartTokens = {
  series1: '#2a78d6',
  series2: '#eb6834',
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#b5b5ae',
  grid: '#ecece8',
  textPrimary: '#171717',
  textSecondary: '#555555',
  textMuted: '#777777',
  surface: '#ffffff',
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

type TooltipState = { left: number; top: number; content: ReactNode } | null

function useChartTooltip() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  function show(event: MouseEvent, content: ReactNode) {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setTooltip({
      left: event.clientX - bounds.left,
      top: event.clientY - bounds.top,
      content,
    })
  }

  function hide() {
    setTooltip(null)
  }

  const node = tooltip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-36 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-[#e5e5e2] bg-white px-3 py-2 text-xs text-[#171717] shadow-lg"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.content}
    </div>
  ) : null

  return { containerRef, show, hide, node }
}

function TooltipLine({
  color,
  label,
  value,
}: {
  color?: string
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2 text-[#555555]">
        {color && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-[#171717]">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status icon (status colors never carry meaning alone)
// ---------------------------------------------------------------------------

export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral'

export function StatusDot({ tone }: { tone: StatusTone }) {
  const color = chartTokens[tone]
  const glyph =
    tone === 'good' ? '✓' : tone === 'critical' ? '!' : tone === 'neutral' ? '–' : '•'

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none"
      style={{
        backgroundColor: color,
        color: tone === 'warning' ? '#0b0b0b' : '#ffffff',
      }}
    >
      {glyph}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail?: string
  tone?: StatusTone
}) {
  return (
    <article className="rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium text-[#666666]">
        {tone && <StatusDot tone={tone} />}
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[#171717]">
        {value}
      </p>
      {detail && <p className="mt-2 text-sm leading-6 text-[#555555]">{detail}</p>}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Segmented status bar (part-to-whole, ≤ 4 segments, legend with counts)
// ---------------------------------------------------------------------------

export type Segment = { label: string; value: number; tone: StatusTone }

export function SegmentedBar({
  segments,
  emptyLabel = 'No data in this view.',
}: {
  segments: Segment[]
  emptyLabel?: string
}) {
  const { containerRef, show, hide, node } = useChartTooltip()
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  if (total === 0) {
    return <p className="text-sm text-[#777777]">{emptyLabel}</p>
  }

  const visible = segments.filter((segment) => segment.value > 0)

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded">
        {visible.map((segment) => (
          <div
            key={segment.label}
            className="h-full transition-opacity hover:opacity-80"
            style={{
              flexGrow: segment.value,
              flexBasis: 0,
              backgroundColor: chartTokens[segment.tone],
            }}
            onMouseMove={(event) =>
              show(
                event,
                <TooltipLine
                  color={chartTokens[segment.tone]}
                  label={segment.label}
                  value={`${segment.value} · ${Math.round((segment.value / total) * 100)}%`}
                />,
              )
            }
            onMouseLeave={hide}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-sm">
            <StatusDot tone={segment.tone} />
            <span className="text-[#555555]">{segment.label}</span>
            <span className="font-semibold tabular-nums text-[#171717]">
              {segment.value}
            </span>
            <span className="tabular-nums text-[#777777]">
              ({Math.round((segment.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>

      {node}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ranked horizontal bar list (single series → no legend box)
// ---------------------------------------------------------------------------

export type RankedItem = {
  label: string
  value: number
  secondary?: string
  tooltip?: Array<{ label: string; value: ReactNode }>
}

export function RankedBarList({
  items,
  valueLabel,
  limit = 8,
  color = chartTokens.series1,
  emptyLabel = 'No activity in this period.',
}: {
  items: RankedItem[]
  valueLabel: string
  limit?: number
  color?: string
  emptyLabel?: string
}) {
  const { containerRef, show, hide, node } = useChartTooltip()

  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return <p className="text-sm text-[#777777]">{emptyLabel}</p>
  }

  const visible = items.slice(0, limit)
  const hidden = items.slice(limit)
  const hiddenTotal = hidden.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(...visible.map((item) => item.value), 1)

  return (
    <div ref={containerRef} className="relative">
      <ul className="space-y-1">
        {visible.map((item) => (
          <li
            key={item.label}
            className="group grid cursor-default grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[#fafaf8] md:grid-cols-[minmax(0,13rem)_1fr_auto]"
            onMouseMove={(event) =>
              show(
                event,
                <>
                  <p className="mb-1 font-semibold">{item.label}</p>
                  <TooltipLine color={color} label={valueLabel} value={item.value} />
                  {item.tooltip?.map((line) => (
                    <TooltipLine key={line.label} label={line.label} value={line.value} />
                  ))}
                </>,
              )
            }
            onMouseLeave={hide}
          >
            <span className="truncate text-sm text-[#171717]" title={item.label}>
              {item.label}
            </span>
            <span className="h-2 w-full">
              <span
                className="block h-2 rounded-r"
                style={{
                  width: `${Math.max((item.value / max) * 100, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </span>
            <span className="min-w-12 text-right text-sm tabular-nums">
              <span className="font-semibold text-[#171717]">{item.value}</span>
              {item.secondary && (
                <span className="ml-1.5 text-xs text-[#777777]">{item.secondary}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {hidden.length > 0 && (
        <p className="mt-2 px-2 text-xs text-[#777777]">
          + {hidden.length} more · {hiddenTotal} {valueLabel.toLowerCase()}
        </p>
      )}

      {node}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grouped column chart: two series, one shared y-axis
// ---------------------------------------------------------------------------

export type ColumnSeries = { key: string; label: string; color: string }

export function GroupedColumnChart<T extends { label: string }>({
  data,
  series,
}: {
  data: T[]
  series: Array<ColumnSeries & { value: (row: T) => number }>
}) {
  const { containerRef, show, hide, node } = useChartTooltip()

  const width = 720
  const height = 240
  const padding = { top: 16, right: 8, bottom: 28, left: 32 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const rawMax = Math.max(1, ...data.flatMap((row) => series.map((s) => s.value(row))))
  const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : 10
  const yMax = Math.ceil(rawMax / step) * step
  const ticks = Array.from({ length: yMax / step + 1 }, (_, index) => index * step)

  const bandWidth = plotWidth / data.length
  const groupWidth = Math.min(bandWidth * 0.7, 40)
  const gap = 2
  const barWidth = (groupWidth - gap * (series.length - 1)) / series.length
  const y = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight

  function columnPath(x: number, value: number) {
    const top = y(value)
    const bottom = padding.top + plotHeight
    const r = Math.min(4, barWidth / 2, bottom - top)
    if (value <= 0 || r <= 0) return ''
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barWidth - r} Q${x + barWidth},${top} ${x + barWidth},${top + r} V${bottom} Z`
  }

  return (
    <div ref={containerRef} className="relative">
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm text-[#555555]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Column chart: ${series.map((s) => s.label).join(' and ')} by month`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? '#d8d8d4' : chartTokens.grid}
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={chartTokens.textMuted}
            >
              {tick}
            </text>
          </g>
        ))}

        {data.map((row, index) => {
          const bandX = padding.left + index * bandWidth
          const groupX = bandX + (bandWidth - groupWidth) / 2
          const isLast = index === data.length - 1

          return (
            <g key={row.label}>
              {series.map((s, seriesIndex) => {
                const x = groupX + seriesIndex * (barWidth + gap)
                const value = s.value(row)
                return (
                  <g key={s.key}>
                    <path d={columnPath(x, value)} fill={s.color} />
                    {isLast && value > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={y(value) - 5}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill={chartTokens.textPrimary}
                      >
                        {value}
                      </text>
                    )}
                  </g>
                )
              })}

              <text
                x={bandX + bandWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                fill={chartTokens.textMuted}
              >
                {row.label}
              </text>

              <rect
                x={bandX}
                y={padding.top}
                width={bandWidth}
                height={plotHeight}
                fill="transparent"
                className="cursor-default hover:fill-[#17171708]"
                onMouseMove={(event) =>
                  show(
                    event,
                    <>
                      <p className="mb-1 font-semibold">{row.label}</p>
                      {series.map((s) => (
                        <TooltipLine key={s.key} color={s.color} label={s.label} value={s.value(row)} />
                      ))}
                    </>,
                  )
                }
                onMouseLeave={hide}
              />
            </g>
          )
        })}
      </svg>

      {node}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

export function ReportCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <article className={`rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          {eyebrow && <p className="text-sm font-medium text-[#666666]">{eyebrow}</p>}
          <h3 className="mt-1 text-lg font-semibold text-[#171717]">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-6 text-[#666666]">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </article>
  )
}
