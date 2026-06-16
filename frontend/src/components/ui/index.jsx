import { forwardRef } from 'react'
import clsx from 'clsx'

/* ── Spinner ── */
export function Spinner({ size = 'sm' }) {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-7 h-7'
  return <span className={clsx('inline-block rounded-full border-2 border-white/30 border-t-white animate-spin-fast', s)} />
}

/* ── Button ── */
const btnBase = 'inline-flex items-center gap-2 font-body font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
const btnVariants = {
  primary:   'bg-brand text-white shadow-brand hover:bg-brand-dark hover:-translate-y-px active:translate-y-0',
  secondary: 'bg-white text-ink border border-fog shadow-sm hover:bg-ghost hover:border-mist',
  ghost:     'bg-transparent text-steel hover:bg-ghost hover:text-ink',
  danger:    'bg-danger text-white hover:bg-red-700',
  success:   'bg-success text-white hover:bg-teal-700',
  outline:   'bg-transparent border border-brand text-brand hover:bg-brand-soft',
}
const btnSizes = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-[0.9375rem]',
  lg: 'px-6 py-3 text-base',
}

export function Btn({ children, variant='primary', size='md', loading, icon, className='', ...p }) {
  return (
    <button className={clsx(btnBase, btnVariants[variant], btnSizes[size], className)} disabled={loading || p.disabled} {...p}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

/* ── Input ── */
export const Input = forwardRef(function Input({ label, error, hint, icon, wrapClass='', className='', ...p }, ref) {
  return (
    <div className={clsx('flex flex-col gap-1', wrapClass)}>
      {label && <label className="text-[0.8125rem] font-medium text-ink-muted tracking-wide">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mist flex pointer-events-none">{icon}</span>}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-white border-[1.5px] rounded-xl px-3.5 py-2.5 text-ink text-[0.9375rem] font-body',
            'placeholder:text-fog outline-none transition-all duration-150',
            'focus:border-brand focus:ring-3 focus:ring-brand/10',
            icon ? 'pl-10' : '',
            error ? 'border-danger focus:ring-danger/10' : 'border-fog',
            className
          )}
          {...p}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-mist">{hint}</p>}
    </div>
  )
})

/* ── Select ── */
export function Select({ label, error, children, wrapClass='', className='', ...p }) {
  return (
    <div className={clsx('flex flex-col gap-1', wrapClass)}>
      {label && <label className="text-[0.8125rem] font-medium text-ink-muted">{label}</label>}
      <select
        className={clsx(
          'w-full bg-white border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-ink text-[0.9375rem] font-body',
          'outline-none focus:border-brand focus:ring-3 focus:ring-brand/10 transition-all duration-150',
          className
        )}
        {...p}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

/* ── Badge ── */
const badgeColors = {
  blue:  'bg-brand-soft text-brand',
  green: 'bg-success-soft text-success',
  amber: 'bg-warn-soft text-warn',
  red:   'bg-danger-soft text-danger',
  gray:  'bg-ghost text-steel',
}
export function Badge({ children, color='blue' }) {
  return <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide', badgeColors[color])}>{children}</span>
}

/* ── Card ── */
export function Card({ children, className='', ...p }) {
  return <div className={clsx('bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden', className)} {...p}>{children}</div>
}

/* ── Stat Card ── */
const statColors = {
  blue:  { icon: 'bg-brand-soft text-brand',   num: 'text-brand' },
  green: { icon: 'bg-success-soft text-success', num: 'text-success' },
  amber: { icon: 'bg-warn-soft text-warn',      num: 'text-warn' },
  red:   { icon: 'bg-danger-soft text-danger',  num: 'text-danger' },
}
export function StatCard({ label, value, icon, color='blue' }) {
  const c = statColors[color]
  return (
    <div className="bg-white rounded-2xl border border-ghost shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>{icon}</div>
      <div>
        <p className="text-[0.8rem] text-mist font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <p className={clsx('font-display text-3xl font-bold leading-none', c.num)}>{value}</p>
      </div>
    </div>
  )
}

/* ── Page Loader ── */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[280px]">
      <span className="w-8 h-8 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin-fast inline-block" />
    </div>
  )
}

/* ── Empty ── */
export function Empty({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-center px-6">
      <div className="text-fog mb-2">{icon}</div>
      <h3 className="font-display text-lg text-ink-muted font-semibold">{title}</h3>
      {sub && <p className="text-sm text-mist max-w-xs leading-relaxed">{sub}</p>}
    </div>
  )
}

/* ── Table ── */
export function Table({ cols, rows, onRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-ghost">
            {cols.map(c => (
              <th key={c.key} className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-widest text-mist whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRow?.(row)}
              className={clsx('border-b border-ghost last:border-0 transition-colors duration-100', onRow ? 'cursor-pointer hover:bg-ghost/60' : 'hover:bg-ghost/40')}
            >
              {cols.map(c => (
                <td key={c.key} className="px-4 py-3.5 text-ink-muted">
                  {c.render ? c.render(row) : (row[c.key] ?? <span className="text-fog">—</span>)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, width=560 }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl shadow-lg w-full animate-fade-up max-h-[90vh] overflow-y-auto" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-ghost sticky top-0 bg-white z-10">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 bg-ghost hover:bg-fog rounded-lg flex items-center justify-center text-steel text-sm transition-colors">✕</button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  )
}

/* ── Pagination ── */
export function Pagination({ page, pages, total, size, onChange }) {
  if (pages <= 1) return null
  const from = (page-1)*size+1, to = Math.min(page*size, total)
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-ghost">
      <span className="text-xs text-mist">{from}–{to} sur {total}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(page-1)} disabled={page===1}
          className="w-8 h-8 rounded-lg border border-fog bg-white text-steel hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">←</button>
        <span className="text-xs font-medium text-steel px-2">{page}/{pages}</span>
        <button onClick={() => onChange(page+1)} disabled={page===pages}
          className="w-8 h-8 rounded-lg border border-fog bg-white text-steel hover:border-brand hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">→</button>
      </div>
    </div>
  )
}

/* ── Tabs ── */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-ghost p-1 rounded-xl">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            active === t.value ? 'bg-white text-brand shadow-xs' : 'text-steel hover:text-ink'
          )}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

/* ── Info Row ── */
export function InfoRow({ label, value, arabic=false }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-ghost last:border-0 gap-4">
      <span className="text-[0.8125rem] text-mist font-medium shrink-0 min-w-[160px]">{label}</span>
      <span className={clsx('text-[0.9375rem] text-ink text-right break-words', arabic && 'font-arabic')} dir={arabic?'rtl':'ltr'}>
        {value || <span className="text-fog">—</span>}
      </span>
    </div>
  )
}

/* ── Alert ── */
const alertStyles = {
  info:    'bg-brand-soft text-brand-dark border-brand/20',
  success: 'bg-success-soft text-teal-800 border-success/20',
  warn:    'bg-warn-soft text-amber-800 border-warn/20',
  error:   'bg-danger-soft text-red-800 border-danger/20',
}
export function Alert({ type='info', icon, children }) {
  return (
    <div className={clsx('flex items-start gap-3 p-3.5 rounded-xl border text-sm leading-relaxed', alertStyles[type])}>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <span>{children}</span>
    </div>
  )
}

/* ── Section Header ── */
export function SectionHead({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {sub && <p className="text-mist text-sm mt-1">{sub}</p>}
      </div>
      {action && <div className="flex gap-2.5 flex-wrap">{action}</div>}
    </div>
  )
}
