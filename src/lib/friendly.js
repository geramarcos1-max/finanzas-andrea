// Textos e iconos pensados para que cualquiera entienda la app sin saber de finanzas.
const EMOJI = {
  Café: '☕', Restaurante: '🍽️', Cine: '🎬', Shopping: '🛍️', Salidas: '🎉', Belleza: '💅',
  Despensa: '🛒', Transporte: '🚗', Salud: '💊', Otro: '✨',
}
export const catEmoji = (name) => EMOJI[name] || '🏷️'

export const GROUP_WHY = {
  obligations: 'Primero lo que no puede faltar este mes.',
  emergency: 'Tu colchón para imprevistos.',
  personal: 'Tu dinero para gastar sin culpa.',
  goals: 'Para que tus metas lleguen a tiempo.',
  longterm: 'Para tu futuro: lo que sobra.',
}

// Semáforo del dinero personal
export function trafficLight(balance, monthly) {
  if (monthly <= 0 && balance <= 0) return { tone: '', icon: '⚪', text: 'Aún no apartas dinero para gastar' }
  if (balance <= 0) return { tone: 'bad', icon: '🔴', text: 'Ya te pasaste de lo que apartaste' }
  if (balance < Math.max(500, monthly * 0.3)) return { tone: 'warn', icon: '🟡', text: 'Cuidado, te queda poco' }
  return { tone: 'good', icon: '🟢', text: 'Vas muy bien' }
}

// "vence en 2 días", "venció hace 3 días", "vence hoy"
export function dueText(dueDay, today = new Date()) {
  if (!dueDay) return ''
  const d = dueDay - today.getDate()
  if (d === 0) return 'vence hoy'
  if (d === 1) return 'vence mañana'
  if (d > 1) return `vence en ${d} días`
  return d === -1 ? 'venció ayer' : `venció hace ${-d} días`
}
