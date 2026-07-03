import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import { useListasCompartidas } from '../hooks/useListaCompartida'
import type { MenuSemanal, Receta } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS, type ClaveMenu } from '../types'

type ItemLista = { nombre: string; cantidad?: number; unidad?: string; precio?: number; comprado?: boolean }

// ── helpers ───────────────────────────────────────────────────────────────────

function buildMenuTexto(menu: MenuSemanal): string {
  let t = '🥗 MI MENÚ SEMANAL — Semana Lista\n'
  t += '─'.repeat(36) + '\n\n'
  for (const dia of DIAS) {
    const bloques: string[] = []
    for (const franja of FRANJAS) {
      const r = menu[`${dia}_${franja}`]
      if (!r) continue
      const icono = franja === 'comida' ? '🍽️ COMIDA' : '🌙 CENA'
      let bloque = `  ${icono}: ${r.nombre}\n`
      bloque += `  ⏱ ${r.tiempo_prep} min · ${r.dificultad} · ~${r.calorias_aprox} kcal\n`
      if (r.descripcion_corta) bloque += `  ${r.descripcion_corta}\n`
      if (r.ingredientes?.length) {
        bloque += `  Ingredientes:\n`
        r.ingredientes.forEach(ing => {
          bloque += `    · ${ing.cantidad} ${ing.unidad} ${ing.nombre}\n`
        })
      }
      bloques.push(bloque)
    }
    if (bloques.length) {
      t += `📅 ${DIAS_LABEL[dia].toUpperCase()}\n${bloques.join('\n')}\n`
    }
  }
  return t.trim()
}

function buildListaTexto(items: ItemLista[], titulo: string): string {
  let t = `🛒 ${titulo.toUpperCase()} — Semana Lista\n`
  t += '─'.repeat(36) + '\n\n'
  const pendientes = items.filter(i => !i.comprado)
  const comprados = items.filter(i => i.comprado)
  if (pendientes.length) {
    pendientes.forEach(i => {
      const cant = i.cantidad ? `${i.cantidad}${i.unidad ? ' ' + i.unidad : ''}` : ''
      const precio = i.precio ? ` — ${i.precio.toFixed(2)} €` : ''
      t += `☐ ${i.nombre}${cant ? ' × ' + cant : ''}${precio}\n`
    })
  }
  if (comprados.length) {
    t += `\n✅ Ya comprado:\n`
    comprados.forEach(i => { t += `  ✓ ${i.nombre}\n` })
  }
  return t.trim()
}

async function copiar(texto: string, setCopied: (v: boolean) => void) {
  await navigator.clipboard.writeText(texto)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

function MenuPreview({ menu }: { menu: MenuSemanal }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const toggle = (dia: string) => setAbiertos(p => ({ ...p, [dia]: !p[dia] }))

  return (
    <div className="space-y-2">
      {DIAS.map(dia => {
        const comida = menu[`${dia}_comida`]
        const cena = menu[`${dia}_cena`]
        if (!comida && !cena) return null
        const abierto = abiertos[dia]
        return (
          <div key={dia} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(dia)}
              className="w-full flex items-center justify-between px-3 py-2 bg-green-select/10 dark:bg-green-900/20 hover:bg-green-select/20 dark:hover:bg-green-900/30 transition-colors"
            >
              <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">{DIAS_LABEL[dia]}</span>
              <span className={`text-gray-400 text-xs transition-transform duration-200 ${abierto ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
            {abierto && (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {comida && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">🍽️ Comida</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{comida.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{comida.descripcion_corta}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">⏱ {comida.tiempo_prep} min</span>
                      <span className="text-[10px] text-gray-400">🔥 {comida.calorias_aprox} kcal</span>
                      {comida.ingredientes?.length > 0 && (
                        <span className="text-[10px] text-gray-400">🧄 {comida.ingredientes.slice(0,3).map(i => i.nombre).join(', ')}{comida.ingredientes.length > 3 ? '…' : ''}</span>
                      )}
                    </div>
                  </div>
                )}
                {cena && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">🌙 Cena</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cena.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cena.descripcion_corta}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">⏱ {cena.tiempo_prep} min</span>
                      <span className="text-[10px] text-gray-400">🔥 {cena.calorias_aprox} kcal</span>
                      {cena.ingredientes?.length > 0 && (
                        <span className="text-[10px] text-gray-400">🧄 {cena.ingredientes.slice(0,3).map(i => i.nombre).join(', ')}{cena.ingredientes.length > 3 ? '…' : ''}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.944a.5.5 0 0 0 .611.611l6.092-1.475A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.877 9.877 0 0 1-5.036-1.378l-.36-.214-3.733.904.92-3.635-.234-.374A9.859 9.859 0 0 1 2.106 12C2.106 6.533 6.533 2.106 12 2.106S21.894 6.533 21.894 12 17.467 21.894 12 21.894z"/>
  </svg>
)

const waClass = 'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors'

// ── sub-componentes ────────────────────────────────────────────────────────────

function ExportCard({
  icon, title, subtitle, accent, children, badge,
}: {
  icon: string; title: string; subtitle: string; accent: string; badge?: string | number; children: React.ReactNode
}) {
  const accentMap: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900',
    blue:  'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900',
    purple:'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900',
    orange:'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900',
  }
  const iconMap: Record<string, string> = {
    green: 'bg-green-100 dark:bg-green-900/40',
    blue:  'bg-blue-100 dark:bg-blue-900/40',
    purple:'bg-purple-100 dark:bg-purple-900/40',
    orange:'bg-orange-100 dark:bg-orange-900/40',
  }
  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${iconMap[accent]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{title}</p>
            {badge !== undefined && (
              <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{badge}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ActionBtn({
  onClick, disabled, loading, children, variant = 'ghost',
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode; variant?: 'ghost' | 'solid'
}) {
  const base = 'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-40'
  const ghost = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
  const solid = 'bg-gray-800 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100'
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variant === 'solid' ? solid : ghost}`}>
      {loading ? <span className="animate-pulse">…</span> : children}
    </button>
  )
}

// ── página principal ───────────────────────────────────────────────────────────

export default function Exportar() {
  const { listas } = useListasCompartidas()

  // Construir menú igual que Menu.tsx: desde estados + seleccion
  const estados = recuperar<Record<ClaveMenu, { estado: string; datos?: { opciones: Receta[] } }>>('menu_estados') ?? ({} as Record<ClaveMenu, { estado: string; datos?: { opciones: Receta[] } }>)
  const seleccion = recuperar<Record<ClaveMenu, number>>('menu_seleccion') ?? ({} as Record<ClaveMenu, number>)
  const menu: MenuSemanal = (() => {
    const m: MenuSemanal = {}
    for (const dia of DIAS) {
      for (const franja of FRANJAS) {
        const clave = `${dia}_${franja}` as ClaveMenu
        const idx = seleccion[clave] ?? 0
        const opciones = estados[clave]?.datos?.opciones
        if (estados[clave]?.estado === 'listo' && opciones?.[idx]) m[clave] = opciones[idx]
      }
    }
    return m
  })()
  const numRecetas = Object.values(menu).filter(Boolean).length

  // Lista personal desde localStorage
  const comprarSet = new Set(recuperar<string[]>('lista_comprar_v3') ?? [])
  const compradoSet = new Set(recuperar<string[]>('lista_comprado') ?? [])
  const cantidades = recuperar<Record<string, number>>('lista_cantidades') ?? {}
  const unidades = recuperar<Record<string, string>>('lista_unidades') ?? {}
  const precios = recuperar<Record<string, number>>('lista_precios') ?? {}
  const custom = recuperar<string[]>('lista_custom_items_v2') ?? []
  function parsearUnidad(raw: string | undefined): { modo: 'ud' | 'kg'; precioKg?: number } {
    if (!raw) return { modo: 'ud' }
    try { return JSON.parse(raw) } catch { return { modo: 'ud' } }
  }

  const todosItems = [...Array.from(comprarSet), ...custom.filter(c => !comprarSet.has(c))]
  const listaPersonal: ItemLista[] = todosItems.map(nombre => {
    const { modo } = parsearUnidad(unidades[nombre])
    return {
      nombre,
      cantidad: cantidades[nombre],
      unidad: modo === 'kg' ? 'kg' : undefined,
      precio: precios[nombre],
      comprado: compradoSet.has(nombre),
    }
  })

  // Estados
  const [copiadoMenu, setCopiadoMenu] = useState(false)
  const [copiadoLista, setCopiadoLista] = useState(false)
  const [copiadoCompartida, setCopiadoCompartida] = useState<Record<string, boolean>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [listaCompartidaItems, setListaCompartidaItems] = useState<Record<string, ItemLista[]>>({})

  const cargarItemsCompartida = useCallback(async (listaId: string) => {
    const { data } = await supabase.from('lista_compartida_items').select('*').eq('lista_id', listaId).order('created_at')
    setListaCompartidaItems(prev => ({ ...prev, [listaId]: (data ?? []) as ItemLista[] }))
  }, [])

  // Cargar automáticamente todas las listas compartidas al entrar
  useEffect(() => {
    listas.forEach(l => cargarItemsCompartida(l.id))
  }, [listas, cargarItemsCompartida])


  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24 page-enter">
      <h1 className="text-2xl font-black tracking-tight mb-1 mt-2">Exportar</h1>
      <p className="text-sm text-gray-400 mb-6">Comparte o descarga tu menú y listas</p>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      <div className="space-y-4">

        {/* ── Menú semanal ── */}
        <ExportCard icon="🥗" title="Menú semanal" subtitle="Tu planificación personal de la semana" accent="green" badge={numRecetas > 0 ? `${numRecetas} recetas` : undefined}>
          {numRecetas === 0 ? (
            <p className="text-xs text-gray-400 italic">No hay recetas generadas todavía</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <ActionBtn onClick={() => copiar(buildMenuTexto(menu), setCopiadoMenu)} disabled={copiadoMenu}>
                  {copiadoMenu ? '✓ Copiado' : '📋 Copiar'}
                </ActionBtn>
                <a href={`https://wa.me/?text=${encodeURIComponent(buildMenuTexto(menu))}`} target="_blank" rel="noopener noreferrer" className={waClass}>
                  <WaIcon /> WhatsApp
                </a>
              </div>
              {/* Preview visual del menú */}
              <MenuPreview menu={menu} />
            </>
          )}
        </ExportCard>

        {/* ── Lista personal ── */}
        <ExportCard icon="🛒" title="Lista de la compra" subtitle="Tu lista personal con cantidades y precios" accent="blue" badge={listaPersonal.length > 0 ? `${listaPersonal.filter(i => !i.comprado).length} pendientes` : undefined}>
          {listaPersonal.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Tu lista personal está vacía</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <ActionBtn onClick={() => copiar(buildListaTexto(listaPersonal, 'Lista de la compra'), setCopiadoLista)} disabled={copiadoLista}>
                  {copiadoLista ? '✓ Copiado' : '📋 Copiar'}
                </ActionBtn>
                <a href={`https://wa.me/?text=${encodeURIComponent(buildListaTexto(listaPersonal, 'Lista de la compra'))}`} target="_blank" rel="noopener noreferrer" className={waClass}>
                  <WaIcon /> WhatsApp
                </a>
              </div>
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {listaPersonal.filter(i => !i.comprado).slice(0, 8).map((item, idx) => (
                  <div key={item.nombre + idx} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm flex-1 truncate">{item.nombre}</span>
                    {item.cantidad && <span className="text-xs text-gray-400 shrink-0">{item.cantidad}{item.unidad ? ' ' + item.unidad : ''}</span>}
                    {item.precio && <span className="text-xs font-medium text-green-select shrink-0">{item.precio.toFixed(2)} €</span>}
                  </div>
                ))}
                {listaPersonal.filter(i => !i.comprado).length > 8 && (
                  <div className="px-3 py-2 text-xs text-gray-400">+{listaPersonal.filter(i => !i.comprado).length - 8} más…</div>
                )}
              </div>
            </>
          )}
        </ExportCard>

        {/* ── Listas compartidas ── */}
        {listas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Listas compartidas</p>
            <div className="space-y-3">
              {listas.map(lista => {
                const items = listaCompartidaItems[lista.id]
                const pendientes = items?.filter(i => !i.comprado && !(i as { en_casa?: boolean }).en_casa) ?? []
                const isCopied = copiadoCompartida[lista.id]
                return (
                  <ExportCard key={lista.id} icon="👥" title={lista.nombre} subtitle={`Código: ${lista.codigo}`} accent="purple" badge={items ? `${pendientes.length} pendientes` : undefined}>
                    {!items ? (
                      <p className="text-xs text-gray-400 animate-pulse">Cargando…</p>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Lista vacía</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <ActionBtn
                            onClick={() => copiar(buildListaTexto(items.filter(i => !(i as { en_casa?: boolean }).en_casa), lista.nombre), (v) => setCopiadoCompartida(p => ({ ...p, [lista.id]: v })))}
                            disabled={isCopied}
                          >
                            {isCopied ? '✓ Copiado' : '📋 Copiar'}
                          </ActionBtn>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(buildListaTexto(items.filter(i => !(i as { en_casa?: boolean }).en_casa), lista.nombre))}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.944a.5.5 0 0 0 .611.611l6.092-1.475A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.877 9.877 0 0 1-5.036-1.378l-.36-.214-3.733.904.92-3.635-.234-.374A9.859 9.859 0 0 1 2.106 12C2.106 6.533 6.533 2.106 12 2.106S21.894 6.533 21.894 12 17.467 21.894 12 21.894z"/></svg>
                            WhatsApp
                          </a>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700 max-h-48 overflow-y-auto">
                          {pendientes.slice(0, 8).map((item, idx) => (
                            <div key={item.nombre + idx} className="flex items-center gap-2 px-3 py-2">
                              <span className="text-sm flex-1 truncate">{item.nombre}</span>
                              {(item as { cantidad?: number }).cantidad && <span className="text-xs text-gray-400 shrink-0">{(item as { cantidad?: number }).cantidad}</span>}
                              {(item as { precio?: number }).precio && <span className="text-xs font-medium text-purple-500 shrink-0">{((item as { precio?: number }).precio ?? 0).toFixed(2)} €</span>}
                            </div>
                          ))}
                          {pendientes.length > 8 && (
                            <div className="px-3 py-2 text-xs text-gray-400">+{pendientes.length - 8} más…</div>
                          )}
                        </div>
                      </>
                    )}
                  </ExportCard>
                )
              })}
            </div>
          </div>
        )}


      </div>
    </div>
  )
}
