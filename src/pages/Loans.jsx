import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/DataContext'
import { cents, totals } from '../lib/calc'
import { fmtDate, monthKey, mxn, mxn0, pct, today } from '../lib/format'
import { Bar, Empty, FormModal, Item, Kpi, PageHead, Pill, confirmDel, opts, run } from '../ui'

const sum = (arr) => arr.reduce((s, l) => s + Number(l.amount), 0)

export default function Loans() {
  const D = useData()
  const [modal, setModal] = useState(null)
  const [personModal, setPersonModal] = useState(null)
  const T = totals(D)
  const MES = today().slice(0, 7)
  const limit = Number(D.settings.loan_limit)
  const people = D.people.filter((p) => !p.archived)
  const accounts = D.accounts.filter((a) => !a.archived)
  const envs = D.envelopes.filter((e) => !e.archived && e.kind !== 'debt')

  const stats = (pid, month, excludeId) => {
    const ls = D.loans.filter((l) => l.person_id === pid && l.id !== excludeId)
    const lent = sum(ls.filter((l) => l.kind === 'prestamo'))
    const paid = sum(ls.filter((l) => l.kind === 'pago'))
    return { lent, paid, owed: lent - paid, lentMonth: sum(ls.filter((l) => l.kind === 'prestamo' && monthKey(l.date) === month)) }
  }

  const fields = [
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    { key: 'person_id', label: 'Persona', type: 'select', options: opts(people), required: true },
    { key: 'kind', label: 'Movimiento', type: 'select', options: [{ value: 'prestamo', label: 'Le presté' }, { value: 'pago', label: 'Me pagó' }] },
    { key: 'amount', label: 'Monto', type: 'money', required: true },
    { key: 'account_id', label: 'Cuenta', type: 'select', options: opts(accounts), required: true },
    { key: 'envelope_id', label: 'Sale del sobre', type: 'select', show: (v) => v.kind === 'prestamo',
      options: [{ value: '', label: 'Ninguno (dinero sin asignar)' }, ...opts(envs)] },
    { key: 'note', label: 'Nota', type: 'text', placeholder: 'Opcional' },
  ]
  const personal = envs.find((e) => e.kind === 'personal')

  const save = (editing) => async (v) => {
    const s = stats(v.person_id, v.date.slice(0, 7), editing?.id)
    if (v.kind === 'prestamo' && cents(s.lentMonth + v.amount) > cents(limit)) {
      return `Ese préstamo pasa el límite de ${mxn0(limit)} del mes de ${v.date.slice(0, 7)}. Puedes prestar hasta ${mxn(Math.max(0, limit - s.lentMonth))}.`
    }
    if (v.kind === 'pago' && cents(v.amount) > cents(s.owed)) return `Solo te debe ${mxn(Math.max(0, s.owed))}; el pago no puede ser mayor.`
    const row = { date: v.date, person_id: v.person_id, kind: v.kind, amount: v.amount, account_id: v.account_id, envelope_id: v.kind === 'prestamo' ? v.envelope_id || null : null, note: v.note || null }
    const q = editing ? supabase.from('loans').update(row).eq('id', editing.id) : supabase.from('loans').insert(row)
    return (await run(q, D.reload, 'Guardado')) ? true : 'No se pudo guardar'
  }

  async function removePerson(p) {
    if (D.loans.some((l) => l.person_id === p.id)) {
      if (window.confirm(`${p.name} ya tiene movimientos, así que se archivará (se conserva el historial). ¿Continuar?`))
        await run(supabase.from('people').update({ archived: true }).eq('id', p.id), D.reload, 'Archivada')
    } else if (confirmDel(p.name)) await run(supabase.from('people').delete().eq('id', p.id), D.reload, 'Eliminada')
  }

  const history = [...D.loans].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <>
      <PageHead title="Préstamos familiares" sub={`Puedes prestar hasta ${mxn0(limit)} por persona al mes. Los pagos que te hagan no liberan cupo del mes; regresan a tu cuenta como dinero sin asignar.`}>
        <button className="btn" onClick={() => setPersonModal({})}>+ Persona</button>
        <button className="btn pri" disabled={!people.length} onClick={() => setModal({})}>+ Registrar movimiento</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Te deben en total" value={mxn0(people.reduce((s, p) => s + Math.max(0, stats(p.id, MES).owed), 0))} />
      </div>
      <h2>Personas</h2>
      <div className="list">
        {people.length === 0 ? <Empty>Agrega a la primera persona.</Empty> : people.map((p) => {
          const s = stats(p.id, MES)
          return (
            <Item key={p.id} title={<>{p.name} {s.owed > 0 && <Pill tone="warn">Te debe {mxn0(s.owed)}</Pill>}</>}
              sub={`Prestado en total ${mxn0(s.lent)} · Te ha pagado ${mxn0(s.paid)}`}
              right={mxn0(s.lentMonth)} rightSub={`quedan ${mxn0(Math.max(0, limit - s.lentMonth))} este mes`}
              actions={<><button className="link edit" onClick={() => setPersonModal({ editing: p })}>Editar</button><button className="link" onClick={() => removePerson(p)}>Quitar</button></>}>
              <div style={{ marginTop: 6 }}><Bar value={s.lentMonth} max={limit} tone={s.lentMonth >= limit ? 'bad' : s.lentMonth > limit * 0.7 ? 'warn' : ''} /></div>
              {s.lent > 0 && <div className="note" style={{ marginTop: 4 }}>Avance de pago {pct((s.paid / s.lent) * 100)}</div>}
            </Item>
          )
        })}
      </div>
      <h2>Historial</h2>
      <div className="list">
        {history.length === 0 ? <Empty>Sin movimientos.</Empty> : history.map((l) => (
          <Item key={l.id} title={<>{D.people.find((p) => p.id === l.person_id)?.name || '—'} <Pill tone={l.kind === 'pago' ? 'good' : ''}>{l.kind === 'pago' ? 'Me pagó' : 'Le presté'}</Pill></>}
            sub={`${fmtDate(l.date)}${l.note ? ' · ' + l.note : ''}`} right={mxn(l.amount)}
            actions={<><button className="link edit" onClick={() => setModal({ editing: l })}>Editar</button>
              <button className="link" onClick={async () => confirmDel('este movimiento') && run(supabase.from('loans').delete().eq('id', l.id), D.reload, 'Eliminado')}>Eliminar</button></>} />
        ))}
      </div>
      {modal && <FormModal title={modal.editing ? 'Editar movimiento' : 'Registrar movimiento'} fields={fields} onClose={() => setModal(null)}
        initial={modal.editing ? { ...modal.editing, amount: String(modal.editing.amount), envelope_id: modal.editing.envelope_id || '', note: modal.editing.note || '' }
          : { date: today(), person_id: people[0]?.id, kind: 'prestamo', amount: '', account_id: accounts[0]?.id, envelope_id: personal?.id || '', note: '' }}
        onSave={save(modal.editing)} />}
      {personModal && <FormModal title={personModal.editing ? 'Editar persona' : 'Agregar persona'} onClose={() => setPersonModal(null)}
        fields={[{ key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej. Mamá' }]}
        initial={personModal.editing ? { name: personModal.editing.name } : {}}
        onSave={async (v) => (await run(personModal.editing ? supabase.from('people').update({ name: v.name.trim() }).eq('id', personModal.editing.id) : supabase.from('people').insert({ name: v.name.trim() }), D.reload, 'Guardado')) ? true : 'No se pudo guardar'} />}
    </>
  )
}
