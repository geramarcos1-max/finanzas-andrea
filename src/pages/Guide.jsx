import { Link } from 'react-router-dom'
import { PageHead } from '../ui'

const SECTIONS = [
  {
    t: '🌟 La idea en 1 minuto',
    body: (
      <>
        <p>Cada vez que te llega dinero, <b>tú decides a dónde va</b>, paso por paso: primero tus pagos, luego lo que quieres para gastar, y lo que sobra se guarda en ahorro o inversión.</p>
        <p>Así siempre sabes <b>cuánto puedes gastar sin meterte en problemas</b>, y tus ahorros salen primero, no con “lo que sobre”.</p>
      </>
    ),
  },
  {
    t: '🚀 Cómo empezar',
    body: (
      <ol>
        <li>La primera vez que entras, la app te pregunta cuánto dinero tienes hoy en tu banco y en efectivo. Solo se hace una vez; después puedes ajustarlo en <Link to="/cuentas">Mi dinero</Link>.</li>
        <li>Ve a <Link to="/pagos">Mis pagos</Link> y agrega lo que pagas cada mes: renta, carro, celular, internet…</li>
        <li>Si tu banco tiene cajitas o apartados, créalos en <Link to="/cuentas">Mi dinero</Link> como cuenta tipo <i>Ahorro</i>.</li>
        <li>Toca <b>“Me llegó dinero”</b> en Inicio y sigue los pasos.</li>
      </ol>
    ),
  },
  {
    t: '💰 Me llegó dinero, ¿qué hago?',
    body: (
      <ol>
        <li>Toca <b>“Me llegó dinero”</b>.</li>
        <li><b>Paso 1:</b> escribe cuánto fue y de quién.</li>
        <li><b>Paso 2:</b> marca los pagos que vas a hacer con ese dinero (carro, renta, abonos a tus metas, préstamo familiar). Los que marques se registran como pagados.</li>
        <li><b>Paso 3:</b> la app te dice cuánto te queda. Escribe cuánto quieres tener para tus gastos personales de este mes.</li>
        <li><b>Paso 4:</b> lo que sobra lo repartes entre ahorro, inversión y tus metas. Hasta que todo tenga destino puedes continuar.</li>
        <li><b>Paso 5:</b> revisa el resumen y confirma.</li>
      </ol>
    ),
  },
  {
    t: '✅ Mis pagos',
    body: (
      <>
        <p>En <Link to="/pagos">Mis pagos</Link> configuras lo que pagas cada mes (monto y día). Funciona como un checklist: cada pago aparece como <i>Pendiente</i>, <i>Vence pronto</i>, <i>Vencido</i> o <i>Pagado</i>.</p>
        <p>Cuando pagues algo, toca <b>“Marcar pagado”</b>. Si te equivocas, toca <b>“Deshacer”</b>. También se marcan solos cuando los eliges al registrar tu dinero.</p>
      </>
    ),
  },
  {
    t: '🧾 Gasté algo',
    body: (
      <ol>
        <li>Toca <b>“Gasté algo”</b>.</li>
        <li>Escribe cuánto, elige el icono de en qué lo gastaste y revisa la <b>fecha</b> (si fue otro día, cámbiala).</li>
        <li>Si quieres, toca <b>“Agregar foto”</b> para guardar la foto del ticket o del comprobante. Solo tú y quien autorices pueden verla.</li>
        <li>Toca <b>Guardar</b>. La app te dice cuánto te queda para gastar.</li>
        <li>Después puedes ver la foto en <Link to="/personales">Mis gastos</Link>, tocando <b>“📎 Foto”</b> en ese gasto.</li>
      </ol>
    ),
  },
  {
    t: '🚦 ¿Qué significa el semáforo?',
    body: (
      <ul>
        <li>🟢 <b>Vas muy bien:</b> te queda bastante dinero para gastar.</li>
        <li>🟡 <b>Cuidado:</b> te queda poco. Gasta con calma.</li>
        <li>🔴 <b>Ya te pasaste:</b> gastaste más de lo que separaste. Espera tu siguiente ingreso o mueve dinero desde otro lado.</li>
      </ul>
    ),
  },
  {
    t: '🏦 Los guardaditos en el banco',
    body: (
      <>
        <p>La app lleva la cuenta de tus ahorros, pero <b>el dinero real vive en tu banco</b>. Si guardas tu ahorro, tu inversión o una meta en una cajita o cuenta aparte, la app te dice qué movimiento hacer.</p>
        <p><b>Ejemplo:</b> te llegan $20,000 a Santander y decides ahorrar $5,000. La app te dirá: <i>“Pasa $5,000 de Santander a tu cajita de ahorro”</i>. Lo haces en el banco y tocas <b>“Ya lo hice ✓”</b>.</p>
        <p>Los guardaditos pendientes aparecen en <b>Inicio → Por hacer</b> para que no se te olviden.</p>
        <p className="note">Para elegir en qué cuenta se guarda tu ahorro, inversión o una meta, entra a ese apartado y busca “¿Dónde guardas este dinero?”.</p>
      </>
    ),
  },
  {
    t: '🎯 Mis metas',
    body: <p>Una meta es algo que quieres lograr, con un monto y una fecha: un viaje, una compra, o un colchón para imprevistos. La app calcula cuánto abonar cada mes y te lo sugiere en el paso 2 cuando te llega dinero.</p>,
  },
  {
    t: '🧮 Mis presupuestos',
    body: <p>Un presupuesto es lo máximo que quieres gastar al mes en algo, por ejemplo en café o en salidas. Los pones en <Link to="/presupuestos">Mis presupuestos</Link>. Si te pasas, la app te avisa en Inicio.</p>,
  },
  {
    t: '🤝 Préstamos familiares',
    body: <p>Anota cuando le prestas dinero a alguien y cuando te lo regresa. Puedes dejar un abono mensual para cada persona y aparecerá como opción en el paso 2. La app te avisa si te pasas del límite mensual.</p>,
  },
  {
    t: '🛠️ Me equivoqué, ¿cómo lo arreglo?',
    body: (
      <ul>
        <li>Casi todo tiene el botón <b>Editar</b> o <b>Eliminar</b>.</li>
        <li>Si eliminas un ingreso, también se quita lo que repartiste con él. Los pagos que marcaste se quitan desde <Link to="/pagos">Mis pagos</Link> con “Deshacer”.</li>
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
