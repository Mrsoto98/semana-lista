import { useNavigate } from 'react-router-dom'

export default function Privacidad() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-2">Política de privacidad</h1>
      <p className="text-xs text-gray-400 mb-8">Última actualización: junio 2026</p>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section>
          <h2 className="font-semibold text-base mb-2">¿Qué datos recogemos?</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Tu dirección de correo electrónico para identificarte.</li>
            <li>Tu perfil de preferencias alimentarias (número de personas, objetivos, ingredientes).</li>
            <li>Los menús semanales que generas y tus recetas favoritas.</li>
            <li>Valoraciones de recetas (likes y dislikes) para personalizar futuras sugerencias.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">¿Para qué los usamos?</h2>
          <p>Usamos tus datos exclusivamente para generar menús personalizados y mejorar las recomendaciones dentro de la app. No vendemos ni compartimos tus datos con terceros con fines comerciales.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">¿Con quién los compartimos?</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Supabase</strong> — proveedor de base de datos y autenticación (servidores en la UE).</li>
            <li><strong>Groq</strong> — proveedor de IA para la generación de recetas. Solo enviamos el texto del prompt, sin datos personales identificativos.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">¿Cuánto tiempo los guardamos?</h2>
          <p>Guardamos tus datos mientras tengas una cuenta activa. Puedes solicitar la eliminación en cualquier momento escribiéndonos.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Tus derechos</h2>
          <p>Tienes derecho a acceder, rectificar y eliminar tus datos. Para ejercerlos, escríbenos a través del formulario de contacto o directamente a nuestro correo.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Cookies</h2>
          <p>Esta app no usa cookies de seguimiento ni publicidad. Solo usamos almacenamiento local del navegador (localStorage) para guardar tu sesión y preferencias locales.</p>
        </section>
      </div>
    </div>
  )
}
