export function compact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M'
  if (a >= 10_000) return (v / 1000).toFixed(a >= 100_000 ? 0 : 1) + 'k'
  if (a >= 100) return Math.round(v).toLocaleString('en-US')
  if (a >= 10) return v.toFixed(0)
  return v.toFixed(1)
}

export function full(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}

export function signedPct(v: number, dp = 1): string {
  if (!isFinite(v)) return '—'
  const s = v >= 0 ? '+' : ''
  return `${s}${v.toFixed(dp)}%`
}

export function money(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${Math.round(v).toLocaleString('en-US')}`
}
