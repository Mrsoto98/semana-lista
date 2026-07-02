// Etiqueta cada ingrediente de ingredientes.json con las cocinas donde encaja.
// Genera supabase/functions/generar-recetas/ingredientes-cocinas.json
// Uso: ANTHROPIC_API_KEY=sk-ant-... node scripts/tag-ingredientes-cocina.js

const fs = require('fs')
const path = require('path')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY en el entorno.')
  process.exit(1)
}

const ingredientesPath = path.join(__dirname, '../supabase/functions/generar-recetas/ingredientes.json')
const outPath = path.join(__dirname, '../supabase/functions/generar-recetas/ingredientes-cocinas.json')

const data = JSON.parse(fs.readFileSync(ingredientesPath, 'utf8'))
const existentes = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {}

// Lista plana única de nombres, en el mismo orden en que aparecen.
// Los que ya tienen etiqueta de una ejecución anterior no se vuelven a pedir.
const nombres = []
const seen = new Set()
for (const lista of Object.values(data)) {
  for (const nombre of lista) {
    if (seen.has(nombre) || existentes[nombre]) continue
    seen.add(nombre)
    nombres.push(nombre)
  }
}

const BATCH_SIZE = 40

async function llamarLote(lote) {
  const lista = lote.map((n, i) => `${i + 1}. ${n}`).join('\n')
  const prompt = `Eres un chef experto. Para cada producto de la lista, indica en qué estilos de cocina encaja, usando SOLO estos códigos:
E=española/mediterránea, I=italiana, AS=asiática, AM=americana, M=mexicana, T=tradicional española de cuchara, S=saludable y ligera
Si es un ingrediente básico usable en cualquier cocina (sal, aceite, ajo, cebolla, arroz blanco, pollo, huevos, leche, verduras genéricas, especias comunes, etc.), responde ["ALL"] para ese producto.
Si es un producto muy específico de un estilo (ej: tortillas de maíz→M, salsa de soja→AS, mozzarella→I), pon solo esos códigos.
Puede tener varios códigos si aplica a varios estilos.

Productos:
${lista}

Responde SOLO JSON: un array de arrays de códigos, en el MISMO ORDEN y misma cantidad que la lista (${lote.length} elementos). Ejemplo: [["ALL"],["M"],["I","E"]]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${res.status}: ${err}`)
  }
  const json = await res.json()
  const text = json.content?.[0]?.text ?? ''
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed) || parsed.length !== lote.length) {
    throw new Error(`Respuesta inesperada: ${parsed.length} elementos vs ${lote.length} esperados`)
  }
  return parsed
}

// Si el modelo no devuelve exactamente el mismo número de elementos, parte
// el lote en dos mitades y reintenta cada una por separado (hasta llegar a 1).
async function etiquetarLote(lote, resultado) {
  if (lote.length === 0) return
  try {
    const tags = await llamarLote(lote)
    lote.forEach((nombre, idx) => { resultado[nombre] = tags[idx] })
  } catch (err) {
    if (lote.length === 1) {
      console.warn(`  ⚠️  No se pudo etiquetar "${lote[0]}", se marca como ALL. (${err.message})`)
      resultado[lote[0]] = ['ALL']
      return
    }
    console.warn(`  ↳ Lote de ${lote.length} falló (${err.message}), partiendo en dos...`)
    const mitad = Math.ceil(lote.length / 2)
    await etiquetarLote(lote.slice(0, mitad), resultado)
    await etiquetarLote(lote.slice(mitad), resultado)
  }
}

async function main() {
  if (nombres.length === 0) {
    console.log('No hay ingredientes nuevos que etiquetar. Todo al día.')
    return
  }
  console.log(`Etiquetando ${nombres.length} ingredientes nuevos en lotes de ${BATCH_SIZE} (${Object.keys(existentes).length} ya etiquetados se reutilizan)...`)
  const resultado = { ...existentes }
  const totalLotes = Math.ceil(nombres.length / BATCH_SIZE)
  for (let i = 0; i < nombres.length; i += BATCH_SIZE) {
    const lote = nombres.slice(i, i + BATCH_SIZE)
    console.log(`Lote ${Math.floor(i / BATCH_SIZE) + 1}/${totalLotes} (${lote.length} items)...`)
    await etiquetarLote(lote, resultado)
  }
  fs.writeFileSync(outPath, JSON.stringify(resultado, null, 2))
  console.log(`✅ Generado: ${outPath}`)
  console.log(`   Ingredientes etiquetados en total: ${Object.keys(resultado).length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
