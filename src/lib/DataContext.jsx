import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'


export const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

const TABLES = {
  accounts: ['created_at', true],
  categories: ['name', true],
  income_sources: ['created_at', true],
  envelopes: ['created_at', true],
  incomes: ['date', false],
  allocations: ['date', false],
  transactions: ['date', false],
  people: ['created_at', true],
  loans: ['date', false],
  pending_moves: ['created_at', true],
  category_budgets: ['category_id', true],
}
const EMPTY = Object.fromEntries(Object.keys(TABLES).map((k) => [k, []]))
const DEFAULT_SETTINGS = { longterm_pct: 10, loan_limit: 1200, setup_done: true }

export function DataProvider({ children }) {
  const [data, setData] = useState({ ...EMPTY, settings: DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    const keys = Object.keys(TABLES)
    const reqs = keys.map((k) => supabase.from(k).select('*').order(TABLES[k][0], { ascending: TABLES[k][1] }))
    const [settingsRes, ...res] = await Promise.all([supabase.from('settings').select('*').eq('id', 1).maybeSingle(), ...reqs])
    const bad = [settingsRes, ...res].find((r) => r.error)
    if (bad) { setError(bad.error.message); setLoading(false); return }
    const next = {}
    keys.forEach((k, i) => { next[k] = res[i].data || [] })
    next.settings = { ...DEFAULT_SETTINGS, ...(settingsRes.data || {}) }
    setError(null)
    setData(next)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return <Ctx.Provider value={{ ...data, loading, error, reload }}>{children}</Ctx.Provider>
}
