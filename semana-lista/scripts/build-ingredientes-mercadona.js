// Genera supabase/functions/generar-recetas/ingredientes.json
// con los nombres de productos Mercadona relevantes para cocinar, sin marcas.

const fs = require('fs')
const path = require('path')

const cat = require('../src/data/mercadona.json')

const MARCAS = /\b(Hacendado|Hero|Carretilla|Pescanova|Findus|Solo|Knorr|Maggi|Florette|Milbona|Casanova|Bimbo|Gallo|SOS|Ferrero|Danone|Activia|Nestlé|Milka|Bezoya|Font Vella|Granini|Don Simón|Cappy|Cidacos|Campofrío|Maheso|La Piara|Fripozo|Litoral|Apis|Ferrer|Bonduelle|Iglo|Birds Eye|Findus|Palacios|Casa Tarradellas|El Pozo|Argal|Reny Picot|Président|Philadelphia|Boursin|La Vache Qui Rit|Bel|Babybel|Laughing Cow|Kraft|Old El Paso)\b/gi

const CAT_COCINA = [
  'Aceite, especias y salsas',
  'Arroz, legumbres y pasta',
  'Carne',
  'Marisco y pescado',
  'Fruta y verdura',
  'Huevos, leche y mantequilla',
  'Charcutería y quesos',
  'Congelados',
  'Conservas, caldos y cremas',
  'Panadería y pastelería',
  'Postres y yogures',
  'Zumos',
]

function limpiar(nombre) {
  return nombre
    .replace(MARCAS, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s*[\(\[].*?[\)\]]\s*/g, '') // quitar paréntesis
    .replace(/,\s*\d+.*$/, '') // quitar "300g", "1 kg", etc al final
    .trim()
}

const resultado = {}
let totalProd = 0

for (const [catNombre, productos] of Object.entries(cat.categorias)) {
  const catMatch = CAT_COCINA.find(c => catNombre.toLowerCase().includes(c.toLowerCase().split(',')[0]))
  if (!catMatch && !CAT_COCINA.some(c => catNombre === c)) {
    // Check exact or partial match
    const match = CAT_COCINA.some(c => catNombre.startsWith(c.split(',')[0]))
    if (!match) continue
  }
  
  const seen = new Set()
  const nombres = []
  for (const p of productos) {
    const limpio = limpiar(p.nombre)
    if (limpio.length < 3 || seen.has(limpio.toLowerCase())) continue
    seen.add(limpio.toLowerCase())
    nombres.push(limpio)
  }
  
  if (nombres.length > 0) {
    resultado[catNombre] = nombres.slice(0, 60) // max 60 por categoría
    totalProd += nombres.length
  }
}

const outPath = path.join(__dirname, '../supabase/functions/generar-recetas/ingredientes.json')
fs.writeFileSync(outPath, JSON.stringify(resultado, null, 2))

const allNames = Object.values(resultado).flat()
console.log(`✅ Generado: ${outPath}`)
console.log(`   Categorías: ${Object.keys(resultado).length}`)
console.log(`   Productos: ${allNames.length}`)
console.log(`   Tamaño: ${(JSON.stringify(resultado).length / 1024).toFixed(1)} KB`)
