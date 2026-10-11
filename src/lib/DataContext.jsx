import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)
export const useData = () => useContext(Ctx)

const EMPTY = {
  accounts: [], balances: [], categories: [], transactions: [], debts: [],
  goals: [], contributions: [], budgets: [], recurring: [], investments: [],
}

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    const q = {
      accounts: supabase.from('accounts').select('*').order('created_at'),
      balances: supabase.from('account_balances').select('*'),
      categories: supabase.from('categories').select('*').order('name'),
      transactions: supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      debts: supabase.from('debt_status').select('*').order('created_at'),
      goals: supabase.from('goal_progress').select('*').order('created_at'),
      contributions: supabase.from('goal_contributions').select('*').order('date', { ascending: false }),
      budgets: supabase.from('budgets').select('*'),
      recurring: supabase.from('recurring_items').select('*').order('day_of_month'),
      investments: supabase.from('investments').select('*').order('created_at'),
    }
    const keys = Object.keys(q)
    const results = await Promise.all(keys.map((k) => q[k]))
    const next = {}
    for (let i = 0; i < keys.length; i++) {
      if (results[i].error) { setError(results[i].error.message); setLoading(false); return }
      next[keys[i]] = results[i].data || []
    }
    setError(null)
    setData(next)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return <Ctx.Provider value={{ ...data, loading, error, reload }}>{children}</Ctx.Provider>
}

// Patrimonio = saldos de cuentas + inversiones - deudas pendientes
export function computeNetWorth({ balances, investments, debts }) {
  const cash = balances.filter((b) => !b.archived).reduce((s, b) => s + Number(b.balance), 0)
  const inv = investments.filter((i) => !i.archived).reduce((s, i) => s + Number(i.current_value), 0)
  const debt = debts.filter((d) => !d.archived).reduce((s, d) => s + Number(d.remaining), 0)
  return { cash, inv, debt, total: cash + inv - debt }
}
