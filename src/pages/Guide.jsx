import { Link } from 'react-router-dom'
import { PageHead } from '../ui'

const SECTIONS = [
  {
    t: '🌟 La idea en 1 minuto',
    body: (
      <>
        <p>Cada vez que te llega dinero, lo repartes en <b>apartados</b>: una parte para tus pagos fijos, otra para tus gastos, otra para ahorrar. Después solo gastas de cada apartado.</p>
        <p>Así siempre sabes <b>cuánto puedes gastar sin meterte en problemas</b>, y tus ahorros salen primero, no con “lo que sobre”.</p>
      </>
    ),
  },
  {
    t: '🚀 Cómo empezar (5 minutos)',
    body: (
      <ol>
        <li>La primera vez que entras, la app te pregunta cuánto dinero tienes hoy en tu banco y en efectivo. Solo se hace una vez; después puedes ajustarlo en <Link to="/cuentas">Mi dinero</Link>.</li>
        <li>Ve a <Link to="/fijos">Pagos fijos</Link> y agrega lo que pagas cada mes: renta, carro, celular, internet…</li>
        <li>Si tu banco tiene cajitas o apartados, créalos también en <Link to="/cuentas">Mi dinero</Link> como cuenta tipo <i>Ahorro</i>. Lo verás en “Los guardaditos”.</li>
        <li>Toca <b>“Me llegó dinero”</b> en Inicio y sigue los pasos.</li>
      </ol>
    ),
  },
  {
    t: '💰 Me llegó dinero, ¿qué hago?',
    body: (
      <ol>
        <li>Toca <b>“Me llegó dinero”</b>.</li>
        <li>Escribe cuánto fue y de quién.</li>
        <li>La app te propone cómo repartirlo. Si estás de acuerdo, toca <b>“Está bien, aceptar”</b>. Si quieres cambiar algo, toca <b>“Quiero cambiar algo”</b>.</li>
        <li>Si guardas tu dinero en cajitas del banco, la app te dice qué movimientos hacer. Eso son los guardaditos.</li>
      </ol>
    ),
  },
  {
    t: '🏦 Los guardaditos en el banco',
    body: (
      <>
        <p>La app lleva la cuenta de tus apartados, pero <b>el dinero real vive en tu banco</b>. Para que ambos coincidan, algunos apartados se guardan en una cajita o cuenta aparte.</p>
        <p><b>Ejemplo:</b> te llegan $20,000 a tu cuenta Santander y $7,000 son para el carro. La app te dirá: <i>“Pasa $7,000 de Santander a tu cajita del Carro”</i>. Lo haces en la app de tu banco y luego tocas <b>“Ya lo hice ✓”</b>.</p>
        <p>Los guardaditos que no hayas hecho aparecen en <b>Inicio → Por hacer</b>, para que no se te olviden.</p>
        <p className="note">Para elegir en qué cuenta se guarda cada apartado, edítalo (en Pagos fijos, Mis metas o Ahorros) y busca “¿Dónde guardas este dinero?”.</p>
      </>
    ),
  },
  {
    t: '🧾 Gasté algo',
    body: (
      <ol>
        <li>Toca <b>“Gasté algo”</b>.</li>
        <li>Escribe cuánto, elige el icono de en qué lo gastaste y toca <b>Guardar</b>.</li>
        <li>La app te dice cuánto te queda para gastar.</li>
      </ol>
    ),
  },
  {
    t: '✅ Pagar renta, carro y demás',
    body: (
      <>
        <p>En <Link to="/pagos">Pagos</Link> ves lo que toca pagar este mes. Cuando pagues algo, toca <b>“Marcar pagado”</b>.</p>
        <p>Si te equivocas, toca <b>“Deshacer”</b>.</p>
      </>
    ),
  },
  {
    t: '🚦 ¿Qué significa el semáforo?',
    body: (
      <ul>
        <li>🟢 <b>Vas muy bien:</b> te queda bastante dinero para gastar.</li>
        <li>🟡 <b>Cuidado:</b> te queda poco. Gasta con calma.</li>
        <li>🔴 <b>Ya te pasaste:</b> gastaste más de lo que apartaste. Toma de otro apartado o espera tu siguiente ingreso.</li>
      </ul>
    ),
  },
  {
    t: '🎯 Mis metas',
    body: <p>Una meta es algo que quieres lograr, con un monto y una fecha. Por ejemplo, un viaje de $12,000 para marzo. La app calcula cuánto apartar cada mes y lo incluye cuando repartes tu dinero.</p>,
  },
  {
    t: '🧮 Mis presupuestos',
    body: <p>Un presupuesto es lo máximo que quieres gastar al mes en algo, por ejemplo en café o en salidas. Los pones en <Link to="/presupuestos">Mis presupuestos</Link>. Si te pasas, la app te avisa en Inicio.</p>,
  },
  {
    t: '🤝 Préstamos familiares',
    body: <p>Anota cuando le prestas dinero a alguien y cuando te lo regresa. La app te avisa si te pasas del límite mensual que tú definiste.</p>,
  },
  {
    t: '🛠️ Me equivoqué, ¿cómo lo arreglo?',
    body: (
      <ul>
        <li>Casi todo tiene el botón <b>Editar</b> o <b>Eliminar</b>.</li>
        <li>Si eliminas un ingreso, también se quita su reparto.</li>
        <li>Si algo no cuadra, revisa que el saldo de tus cuentas en <Link to="/cuentas">Mi dinero</Link> sea igual al de tu banco.</li>
      </ul>
    ),
  },
  {
    t: '🔐 Mis datos están seguros',
    body: <p>Solo tú y las personas que autorices pueden entrar. Puedes descargar un respaldo de todo en <Link to="/config">Configuración</Link>.</p>,
  },
]

export default function Guide() {
  return (
    <>
      <PageHead title="Cómo usar la app" sub="Respuestas sencillas a lo que más te vas a preguntar. Toca cada título para abrirlo." />
      <div className="guide">
        {SECTIONS.map((s, i) => (
          <details key={s.t} open={i === 0}>
            <summary>{s.t}</summary>
            <div className="gbody">{s.body}</div>
          </details>
        ))}
      </div>
    </>
  )
}
