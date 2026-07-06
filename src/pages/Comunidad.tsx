// src/pages/Comunidad.tsx
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useComunidad, type Publicacion } from '../hooks/useComunidad'
import { Avatar } from '../components/Avatar'
import { createPortal } from 'react-dom'

// ── Utilidades ────────────────────────────────────────────────
function tiempoRelativo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const VISIBILIDAD_LABEL: Record<string, string> = {
  publico: '🌍 Público',
  amigos: '👥 Amigos',
  privado: '🔒 Privado',
}

// ── Modal crear publicación ───────────────────────────────────
function ModalCrear({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const { crearPublicacion } = useComunidad()
  const [tipo, setTipo] = useState<'foto' | 'receta_personal'>('foto')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [recetaNombre, setRecetaNombre] = useState('')
  const [visibilidad, setVisibilidad] = useState<'publico' | 'amigos' | 'privado'>('publico')
  const [fotos, setFotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [pasos, setPasos] = useState<string[]>([''])
  const [ingredientes, setIngredientes] = useState<{ nombre: string; cantidad: string; unidad: string }[]>([
    { nombre: '', cantidad: '', unidad: 'g' }
  ])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const inputFotoRef = useRef<HTMLInputElement>(null)

  function seleccionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    setFotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  function actualizarPaso(i: number, v: string) {
    setPasos(prev => prev.map((p, idx) => idx === i ? v : p))
  }
  function añadirPaso() { setPasos(prev => [...prev, '']) }
  function quitarPaso(i: number) { setPasos(prev => prev.filter((_, idx) => idx !== i)) }

  function actualizarIng(i: number, campo: string, v: string) {
    setIngredientes(prev => prev.map((ing, idx) => idx === i ? { ...ing, [campo]: v } : ing))
  }
  function añadirIng() { setIngredientes(prev => [...prev, { nombre: '', cantidad: '', unidad: 'g' }]) }
  function quitarIng(i: number) { setIngredientes(prev => prev.filter((_, idx) => idx !== i)) }

  async function enviar() {
    if (!titulo.trim()) return setError('El título es obligatorio')
    if (fotos.length === 0) return setError('Añade al menos una foto')
    setEnviando(true)
    setError('')
    const ings = tipo === 'receta_personal'
      ? ingredientes.filter(i => i.nombre.trim()).map(i => ({
          nombre: i.nombre, cantidad: parseFloat(i.cantidad) || 0, unidad: i.unidad
        }))
      : undefined
    const ps = tipo === 'receta_personal' ? pasos.filter(p => p.trim()) : undefined
    const { error: err } = await crearPublicacion({
      tipo,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      receta_nombre: recetaNombre.trim() || undefined,
      ingredientes: ings,
      pasos: ps,
      fotos,
      visibilidad,
    })
    setEnviando(false)
    if (err) return setError(err)
    onCreada()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800 dark:text-gray-100">Nueva publicación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">×</button>
        </div>

        {/* Tipo */}
        <div className="flex gap-2">
          {(['foto', 'receta_personal'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tipo === t ? 'bg-green-select text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {t === 'foto' ? '📸 Foto' : '👨‍🍳 Receta personal'}
            </button>
          ))}
        </div>

        {/* Fotos */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
            Fotos (máx. 4)
          </label>
          <div className="flex gap-2 flex-wrap">
            {previews.map((p, i) => (
              <img key={i} src={p} className="w-20 h-20 object-cover rounded-xl border border-white/30" />
            ))}
            {previews.length < 4 && (
              <button onClick={() => inputFotoRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 text-2xl">
                +
              </button>
            )}
          </div>
          <input ref={inputFotoRef} type="file" accept="image/*" multiple className="hidden" onChange={seleccionarFotos} />
        </div>

        {/* Título */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
            {tipo === 'foto' ? 'Título' : 'Nombre de la receta'}
          </label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120}
            placeholder={tipo === 'foto' ? 'Ej: Paella de hoy 🔥' : 'Ej: Tortilla de mi abuela'}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-green-select/40" />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
            Descripción <span className="font-normal normal-case">(opcional)</span>
          </label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={500} rows={2}
            placeholder="Cuéntanos algo sobre este plato..."
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-green-select/40 resize-none" />
        </div>

        {/* Ingredientes y pasos solo para receta personal */}
        {tipo === 'receta_personal' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Ingredientes</label>
              <div className="flex flex-col gap-2">
                {ingredientes.map((ing, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={ing.nombre} onChange={e => actualizarIng(i, 'nombre', e.target.value)}
                      placeholder="Ingrediente" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-100 outline-none" />
                    <input value={ing.cantidad} onChange={e => actualizarIng(i, 'cantidad', e.target.value)}
                      placeholder="100" type="number" className="w-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-100 outline-none" />
                    <select value={ing.unidad} onChange={e => actualizarIng(i, 'unidad', e.target.value)}
                      className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1.5 text-sm text-gray-800 dark:text-gray-100 outline-none">
                      {['g','kg','ml','l','ud','cda','pizca'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    {ingredientes.length > 1 && (
                      <button onClick={() => quitarIng(i)} className="text-red-400 text-lg leading-none">×</button>
                    )}
                  </div>
                ))}
                <button onClick={añadirIng} className="text-xs text-green-select font-semibold text-left mt-1">+ Añadir ingrediente</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Pasos</label>
              <div className="flex flex-col gap-2">
                {pasos.map((paso, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-xs font-bold text-gray-400 mt-2 w-4 shrink-0">{i + 1}.</span>
                    <textarea value={paso} onChange={e => actualizarPaso(i, e.target.value)} rows={2}
                      placeholder={`Paso ${i + 1}...`}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-100 outline-none resize-none" />
                    {pasos.length > 1 && (
                      <button onClick={() => quitarPaso(i)} className="text-red-400 text-lg leading-none mt-1">×</button>
                    )}
                  </div>
                ))}
                <button onClick={añadirPaso} className="text-xs text-green-select font-semibold text-left mt-1">+ Añadir paso</button>
              </div>
            </div>
          </>
        )}

        {/* Privacidad */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Privacidad</label>
          <div className="flex gap-2">
            {(['publico', 'amigos', 'privado'] as const).map(v => (
              <button key={v} onClick={() => setVisibilidad(v)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${visibilidad === v ? 'bg-green-select text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                {VISIBILIDAD_LABEL[v]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={enviar} disabled={enviando}
          className="w-full py-3 bg-green-select text-white font-black rounded-2xl disabled:opacity-50">
          {enviando ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Modal detalle publicación ─────────────────────────────────
function ModalDetalle({ pub, onClose, onLike, onEliminar, miId }: {
  pub: Publicacion
  onClose: () => void
  onLike: () => void
  onEliminar: () => void
  miId?: string
}) {
  const [fotoIdx, setFotoIdx] = useState(0)
  const esPropia = pub.usuario_id === miId

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        {/* Foto */}
        {pub.fotos.length > 0 && (
          <div className="relative">
            <img src={pub.fotos[fotoIdx]} alt={pub.titulo}
              className="w-full aspect-square object-cover rounded-t-3xl sm:rounded-t-2xl" />
            {pub.fotos.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {pub.fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === fotoIdx ? 'bg-white' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
            <button onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white text-lg leading-none">×</button>
          </div>
        )}

        <div className="p-5 flex flex-col gap-4">
          {/* Cabecera autor */}
          <div className="flex items-center gap-3">
            <Avatar emoji={pub.autor?.avatar_emoji} url={pub.autor?.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pub.autor?.nombre_display ?? 'Usuario'}</p>
              <p className="text-xs text-gray-400">{tiempoRelativo(pub.created_at)} · {VISIBILIDAD_LABEL[pub.visibilidad]}</p>
            </div>
            {esPropia && (
              <button onClick={onEliminar} className="text-xs text-red-400 font-semibold">Eliminar</button>
            )}
          </div>

          {/* Contenido */}
          <div>
            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">{pub.titulo}</h3>
            {pub.descripcion && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{pub.descripcion}</p>}
          </div>

          {/* Like */}
          <button onClick={onLike}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${pub.yo_di_like ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
            <span className="text-xl">{pub.yo_di_like ? '❤️' : '🤍'}</span>
            <span>{pub.likes_count} {pub.likes_count === 1 ? 'me gusta' : 'me gusta'}</span>
          </button>

          {/* Ingredientes */}
          {pub.ingredientes && pub.ingredientes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ingredientes</h4>
              <ul className="flex flex-col gap-1">
                {pub.ingredientes.map((ing, i) => (
                  <li key={i} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>{ing.nombre}</span>
                    <span className="text-gray-400">{ing.cantidad} {ing.unidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pasos */}
          {pub.pasos && pub.pasos.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Preparación</h4>
              <ol className="flex flex-col gap-3">
                {pub.pasos.map((paso, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-6 h-6 rounded-full bg-green-select/15 text-green-select flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span>{paso}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tarjeta de publicación ────────────────────────────────────
function TarjetaPublicacion({ pub, onLike, onClick }: {
  pub: Publicacion
  onLike: (e: React.MouseEvent) => void
  onClick: () => void
}) {
  return (
    <div className="card item-enter cursor-pointer overflow-hidden" onClick={onClick}>
      {pub.foto_portada && (
        <img src={pub.foto_portada} alt={pub.titulo}
          className="w-full aspect-square object-cover" />
      )}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Avatar emoji={pub.autor?.avatar_emoji} url={pub.autor?.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
              {pub.autor?.nombre_display ?? 'Usuario'}
            </p>
            <p className="text-xs text-gray-400">{tiempoRelativo(pub.created_at)}</p>
          </div>
          {pub.tipo === 'receta_personal' && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
              Receta
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 line-clamp-2">{pub.titulo}</p>
        <button onClick={onLike}
          className={`flex items-center gap-1.5 text-xs font-semibold w-fit transition-transform active:scale-110 ${pub.yo_di_like ? 'text-red-500' : 'text-gray-400'}`}>
          <span>{pub.yo_di_like ? '❤️' : '🤍'}</span>
          <span>{pub.likes_count}</span>
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function Comunidad() {
  const { user } = useAuth()
  const { publicaciones, loading, hasMore, cargar, toggleLike, eliminar } = useComunidad()
  const [modalCrear, setModalCrear] = useState(false)
  const [detalle, setDetalle] = useState<Publicacion | null>(null)
  const [pagina, setPagina] = useState(0)

  useEffect(() => { cargar(0) }, [cargar])

  function cargarMas() {
    const sig = pagina + 12
    setPagina(sig)
    cargar(sig)
  }

  async function handleEliminar(pub: Publicacion) {
    if (!confirm('¿Eliminar esta publicación?')) return
    await eliminar(pub.id)
    setDetalle(null)
  }

  return (
    <div className="min-h-dvh pb-24">
      {/* Header */}
      <div className="glass-header sticky top-0 z-30 px-4 pt-safe-top py-3 flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-800 dark:text-gray-100">Comunidad</h1>
        {user && (
          <button onClick={() => setModalCrear(true)}
            className="bg-green-select text-white text-sm font-bold px-4 py-2 rounded-xl">
            + Publicar
          </button>
        )}
      </div>

      {/* Feed grid */}
      <div className="px-3 pt-4">
        {loading && publicaciones.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card overflow-hidden skeleton-pulse">
                <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
                <div className="p-3 flex flex-col gap-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : publicaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <span className="text-6xl">🍽️</span>
            <h2 className="text-xl font-black text-gray-700 dark:text-gray-200">Sé el primero en publicar</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Comparte fotos de tus recetas con la comunidad</p>
            {user && (
              <button onClick={() => setModalCrear(true)}
                className="mt-2 bg-green-select text-white font-bold px-6 py-3 rounded-2xl">
                Publicar ahora
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {publicaciones.map(pub => (
                <TarjetaPublicacion key={pub.id} pub={pub}
                  onLike={e => { e.stopPropagation(); toggleLike(pub) }}
                  onClick={() => setDetalle(pub)} />
              ))}
            </div>
            {hasMore && (
              <button onClick={cargarMas} disabled={loading}
                className="w-full mt-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-semibold disabled:opacity-40">
                {loading ? 'Cargando...' : 'Ver más'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      {modalCrear && (
        <ModalCrear onClose={() => setModalCrear(false)} onCreada={() => cargar(0)} />
      )}
      {detalle && (
        <ModalDetalle pub={detalle} miId={user?.id}
          onClose={() => setDetalle(null)}
          onLike={() => { toggleLike(detalle); setDetalle(prev => prev ? { ...prev, yo_di_like: !prev.yo_di_like, likes_count: prev.likes_count + (prev.yo_di_like ? -1 : 1) } : null) }}
          onEliminar={() => handleEliminar(detalle)} />
      )}
    </div>
  )
}
