// src/pages/Exportar.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import { usePerfil } from '../hooks/usePerfil'
import { useAuth } from '../hooks/useAuth'
import type { MenuSemanal } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

export default function Exportar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { perfil } = usePerfil()
  const exportRef = useRef<HTMLDivElement>(null)
  const [guardando, setGuardando] = useState(false)
  const [enlacePublico, setEnlacePublico] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [pdfGenerando, setPdfGenerando] = useState(false)

  const menu = recuperar<MenuSemanal>('menu_semana') ?? {}

  function buildTextoPlano(): string {
    let texto = '🥗 SEMANA LISTA — Mi menú semanal\n\n'
    for (const dia of DIAS) {
      texto += `${DIAS_LABEL[dia].toUpperCase()}\n`
      for (const franja of FRANJAS) {
        const receta = menu[`${dia}_${franja}`]
        if (receta) {
          texto += `  ${franja === 'comida' ? '🍽️ Comida' : '🌙 Cena'}: ${receta.nombre} (${receta.tiempo_prep} min)\n`
        }
      }
      texto += '\n'
    }
    return texto
  }

  async function copiarPortapapeles() {
    await navigator.clipboard.writeText(buildTextoPlano())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function generarPDF() {
    if (!exportRef.current) return
    setPdfGenerando(true)
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgRatio = canvas.height / canvas.width
      const imgH = pageW * imgRatio
      let yPos = 0
      let remaining = imgH

      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH)
        remaining -= pageH
        yPos += pageH
        if (remaining > 0) pdf.addPage()
      }

      pdf.save('semana-lista.pdf')
    } finally {
      setPdfGenerando(false)
    }
  }

  async function guardarYCompartir() {
    if (!user || !perfil) return
    setGuardando(true)

    try {
      // Save semana to DB
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay() + 1) // this Monday

      const { data: semana } = await supabase
        .from('semanas')
        .insert({
          usuario_id: user.id,
          fecha_inicio: fechaInicio.toISOString().split('T')[0],
          recetas_elegidas: menu,
          lista_compra: [],
          es_publica: true,
        })
        .select()
        .single()

      // Save historial_recetas
      const recetas = Object.values(menu)
        .filter(Boolean)
        .map(r => ({ usuario_id: user.id, nombre_receta: r!.nombre, fecha_uso: fechaInicio.toISOString().split('T')[0] }))

      if (recetas.length) {
        await supabase.from('historial_recetas').insert(recetas)
      }

      if (semana?.id) {
        const url = `${window.location.origin}/menu/${semana.id}`
        setEnlacePublico(url)
      }
    } catch (err) {
      console.error('Error guardando semana:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">📤 Exportar</h1>
        <button onClick={() => navigate('/lista')} className="text-sm text-gray-500">← Lista</button>
      </div>

      <div className="space-y-3 mb-6">
        <button
          onClick={generarPDF}
          disabled={pdfGenerando}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors disabled:opacity-50 flex items-center gap-3"
        >
          <span className="text-2xl">📄</span>
          <div>
            <p className="font-semibold">Descargar PDF</p>
            <p className="text-sm text-gray-500">Menú semanal + lista de la compra</p>
          </div>
          {pdfGenerando && <span className="ml-auto text-sm text-gray-400">Generando...</span>}
        </button>

        <button
          onClick={copiarPortapapeles}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors flex items-center gap-3"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-semibold">{copiado ? '¡Copiado!' : 'Copiar para WhatsApp'}</p>
            <p className="text-sm text-gray-500">Texto plano del menú</p>
          </div>
        </button>

        <button
          onClick={guardarYCompartir}
          disabled={guardando || !!enlacePublico}
          className="w-full bg-white dark:bg-gray-900 border rounded-card p-4 text-left hover:border-green-select transition-colors disabled:opacity-50 flex items-center gap-3"
        >
          <span className="text-2xl">🔗</span>
          <div>
            <p className="font-semibold">Crear enlace público</p>
            <p className="text-sm text-gray-500">Guarda la semana y genera link</p>
          </div>
          {guardando && <span className="ml-auto text-sm text-gray-400">Guardando...</span>}
        </button>

        {enlacePublico && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-card">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Enlace creado:</p>
            <a href={enlacePublico} target="_blank" rel="noopener noreferrer"
              className="text-sm text-green-select hover:underline break-all">
              {enlacePublico}
            </a>
          </div>
        )}
      </div>

      {/* Printable content for PDF */}
      <div ref={exportRef} className="bg-white text-gray-900 p-6 rounded-card border">
        <h2 className="text-xl font-bold mb-4">🥗 Mi semana</h2>
        {DIAS.map(dia => (
          <div key={dia} className="mb-4">
            <h3 className="font-bold text-base mb-1">{DIAS_LABEL[dia]}</h3>
            {FRANJAS.map(franja => {
              const receta = menu[`${dia}_${franja}`]
              if (!receta) return null
              return (
                <p key={franja} className="text-sm mb-0.5 pl-2">
                  <strong>{franja === 'comida' ? 'Comida' : 'Cena'}:</strong>{' '}
                  {receta.nombre} ({receta.tiempo_prep} min · {receta.dificultad})
                </p>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
