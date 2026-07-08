import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#111827] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <img src="/icon-192.svg" alt="Semana Lista" className="w-8 h-8" />
          <span className="font-black text-lg">Semana Lista</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-semibold text-green-400 border border-green-400/40 px-4 py-1.5 rounded-full"
        >
          Entrar
        </button>
      </header>

      {/* Hero */}
      <section className="px-6 pt-10 pb-12 max-w-lg mx-auto text-center">
        <div className="text-6xl mb-5">🥗</div>
        <h1 className="text-4xl font-black leading-tight mb-4">
          Tu menú semanal<br />
          <span className="text-green-400">con IA en segundos</span>
        </h1>
        <p className="text-gray-400 text-base leading-relaxed mb-8">
          Planifica toda la semana, genera la lista de la compra automáticamente
          y encuentra los mejores precios en Mercadona.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-green-500 hover:bg-green-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 transition-all active:scale-95"
        >
          Empezar gratis
        </button>
        <p className="text-xs text-gray-500 mt-3">Sin tarjeta de crédito. Gratis para empezar.</p>
      </section>

      {/* Features */}
      <section className="px-5 pb-12 max-w-lg mx-auto">
        <h2 className="text-xl font-black text-center mb-6 text-gray-200">Todo lo que necesitas</h2>
        <div className="grid grid-cols-1 gap-4">
          {[
            { icon: '🤖', title: 'IA que entiende tu dieta', desc: 'Genera recetas adaptadas a vegetarianos, veganos, sin gluten y más. Tú decides.' },
            { icon: '🛒', title: 'Lista de la compra automática', desc: 'Selecciona los días y genera la lista al instante. Sin olvidar nada.' },
            { icon: '💰', title: 'Precios de Mercadona', desc: 'Compara productos y precios reales de Mercadona directamente en la app.' },
            { icon: '👥', title: 'Comparte con tu familia', desc: 'Listas compartidas en tiempo real con tu pareja, familia o compañeros de piso.' },
            { icon: '📤', title: 'Exporta fácil', desc: 'Envía la lista por WhatsApp o correo con un solo toque.' },
            { icon: '📱', title: 'Instálala como app', desc: 'Añádela a tu pantalla de inicio y tenla siempre a mano, como una app nativa.' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/8">
              <span className="text-3xl shrink-0">{f.icon}</span>
              <div>
                <p className="font-bold text-sm text-gray-100 mb-0.5">{f.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 pb-12 max-w-lg mx-auto">
        <h2 className="text-xl font-black text-center mb-6 text-gray-200">¿Cómo funciona?</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Cuéntanos tu dieta', desc: 'Dinos si eres vegetariano, tu objetivo y cuántas personas coméis.' },
            { step: '2', title: 'Genera tu menú', desc: 'La IA crea un menú variado y equilibrado para toda la semana.' },
            { step: '3', title: 'Compra sin esfuerzo', desc: 'Genera la lista de la compra y ve al supermercado con todo listo.' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0 font-black text-sm">
                {s.step}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-100 mb-0.5">{s.title}</p>
                <p className="text-xs text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-16 max-w-lg mx-auto text-center">
        <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-8">
          <p className="text-2xl font-black mb-2">¿Listo para empezar?</p>
          <p className="text-gray-400 text-sm mb-6">Únete a las familias que ya planifican su semana con IA.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 active:scale-95 transition-all"
          >
            Crear cuenta gratis
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-8 text-xs text-gray-600">
        <p>© 2025 Semana Lista · <a href="/privacidad" className="underline">Privacidad</a></p>
      </footer>
    </div>
  )
}
