// src/pages/Lista.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IngredienteRow } from '../components/IngredienteRow'
import { Skeleton } from '../components/ui/Skeleton'
import { recuperar } from '../lib/storage'
import { usePerfil } from '../hooks/usePerfil'
import type { MenuSemanal, Ingrediente, ResultadoPrecio } from '../types'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/precios-mercadona`

const CATEGORIAS_ORDEN = [
  'Verduras y frutas',
  'Carnes y pescados',
  'Lácteos y huevos',
  'Legumbres y cereales',
  'Enlatados y conservas',
  'Otros',
]

function categorizar(nombre: string): string {
  const n = nombre.toLowerCase()
  if (/tomate|cebolla|ajo|pimiento|zanahoria|patata|espinaca|brócoli|lechuga|pepino|calabacín|berenjena|champiñon|limón|naranja|manzana|plátano|fruta|verdura|ensalada|acelga|puerro|coliflor/.test(n)) return 'Verduras y frutas'
  if (/pollo|ternera|cerdo|carne|bacalao|salmón|atún|merluza|gambas|mejillones|huevo|pechuga|filete|jamón|chorizo/.test(n)) return 'Carnes y pescados'
  if (/leche|queso|yogur|mantequilla|nata|crema|lácteo/.test(n)) return 'Lácteos y huevos'
  if (/lentejas|garbanzos|judías|arroz|pasta|macarrones|espagueti|harina|avena|pan|cereales/.test(n)) return 'Legumbres y cereales'
  if (/lata|conserva|tomate triturado|atún en lata|sardinas|caldo|bote|frasco/.test(n)) return 'Enlatados y conservas'
  return 'Otros'
}

function agregarIngredientes(menu: MenuSemanal, nevera: string[]): Ingrediente[] {
  const mapa = new Map<string, Ingrediente>()

  for (const receta of Object.values(menu)) {
    if (!receta) continue
    for (const ing of receta.ingredientes) {
      const clave = ing.nombre.toLowerCase().trim()
      // Skip if user already has it
      if (nevera.some(n => clave.includes(n.toLowerCase()))) continue

      const existing = mapa.get(clave)
      if (existing && existing.unidad === ing.unidad) {
        mapa.set(clave, { ...existing, cantidad: existing.cantidad + ing.cantidad })
      } else {
        mapa.set(clave, { ...ing })
      }
    }
  }

  return Array.from(mapa.values())
}

export default function Lista() {
  const navigate = useNavigate()
  const { perfil } = usePerfil()
  const [resultados, setResultados] = useState<ResultadoPrecio[]>([])
  const [cargando, setCargando] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu || !perfil) { setCargando(false); return }

    const ingredientes = agregarIngredientes(menu, perfil.nevera ?? [])

    fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientes: ingredientes.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          unidad: i.unidad,
        })),
        codigo_postal: perfil.codigo_postal,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setResultados(data.resultados ?? [])
        setCargando(false)
      })
      .catch(err => {
        setError(err.message)
        setCargando(false)
      })
  }, [perfil])

  function toggleChecked(nombre: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(nombre) ? next.delete(nombre) : next.add(nombre)
      return next
    })
  }

  const total = resultados.reduce((sum, r) => sum + (r.coste_real ?? 0), 0)
  const sobrepresupuesto = perfil && total > perfil.presupuesto

  // Group by category
  const porCategoria = new Map<string, ResultadoPrecio[]>()
  for (const r of resultados) {
    const cat = categorizar(r.ingrediente)
    if (!porCategoria.has(cat)) porCategoria.set(cat, [])
    porCategoria.get(cat)!.push(r)
  }

  if (cargando) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">🛒 Lista de la compra</h1>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} lines={2} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto flex items-center justify-center">
        <p className="text-red-500">Error al cargar precios: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🛒 Lista de la compra</h1>
        <button
          onClick={() => navigate('/menu')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Menú
        </button>
      </div>

      {sobrepresupuesto && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-card text-sm text-red-700 dark:text-red-300">
          ⚠️ Total estimado ({total.toFixed(2)} €) supera tu presupuesto de {perfil!.presupuesto} €
        </div>
      )}

      <div className="space-y-6">
        {CATEGORIAS_ORDEN.filter(cat => porCategoria.has(cat)).map(cat => (
          <div key={cat}>
            <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide mb-2">
              {cat}
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-card border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {porCategoria.get(cat)!.map(r => (
                <div key={r.ingrediente} className="px-3">
                  <IngredienteRow
                    resultado={r}
                    checked={checked.has(r.ingrediente)}
                    onToggle={() => toggleChecked(r.ingrediente)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total estimado</p>
            <p className={`text-2xl font-bold ${sobrepresupuesto ? 'text-red-500' : 'text-green-select'}`}>
              {total.toFixed(2)} €
            </p>
            {perfil && (
              <p className="text-xs text-gray-400">
                {(total / 7 / perfil.personas).toFixed(2)} € / persona / día
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/exportar')}
            className="bg-orange-accent text-white rounded-card px-6 py-3 font-semibold hover:opacity-90"
          >
            Exportar →
          </button>
        </div>
      </div>
    </div>
  )
}
