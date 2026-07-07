// debug-sesion.mjs — Muestra exactamente qué devuelve Mercadona al cambiar de CP
// node scripts/debug-sesion.mjs

const CPS = ['08001', '28001', '35001'] // Barcelona, Madrid, Canarias

const BASE_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':          'application/json',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Referer':         'https://tienda.mercadona.es/',
  'Origin':          'https://tienda.mercadona.es',
}

function parseCookies(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? '']
  return all.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
}

for (const cp of CPS) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`CP: ${cp}`)
  console.log('='.repeat(60))

  // Paso 1: inicializar sesión visitando la home
  const home = await fetch('https://tienda.mercadona.es/', { headers: BASE_HEADERS })
  let cookie = parseCookies(home)
  console.log(`Home cookies: ${cookie.substring(0, 80)}`)

  // Paso 2: intentar fijar CP (first time, no change)
  const r1 = await fetch('https://tienda.mercadona.es/api/postal-codes/', {
    method: 'POST',
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ postal_code: cp }),
  })
  const extra1 = parseCookies(r1)
  if (extra1) cookie += '; ' + extra1
  const b1 = await r1.text()
  console.log(`POST postal-codes status: ${r1.status}  body: ${b1.substring(0, 200)}`)

  // Paso 3: cambiar CP
  const r2 = await fetch('https://tienda.mercadona.es/api/postal-codes/actions/change-pc/', {
    method: 'PUT',
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ new_postal_code: cp }),
  })
  const extra2 = parseCookies(r2)
  if (extra2) cookie += '; ' + extra2
  const b2 = await r2.text()
  console.log(`PUT change-pc status: ${r2.status}  body: ${b2.substring(0, 200)}`)

  // Paso 4: fetchear categorías y contar
  const cats = await fetch('https://tienda.mercadona.es/api/categories/?lang=es', {
    headers: { ...BASE_HEADERS, Cookie: cookie }
  })
  const catsData = await cats.json()
  const numCats = (catsData.results ?? []).length
  console.log(`Categorias: ${numCats}`)

  // Contar productos de primera subcategoría como muestra
  const primeraSubId = (catsData.results?.[0]?.categories?.[0]?.id)
  if (primeraSubId) {
    const sub = await fetch(`https://tienda.mercadona.es/api/categories/${primeraSubId}/?lang=es`, {
      headers: { ...BASE_HEADERS, Cookie: cookie }
    })
    const subData = await sub.json()
    const prods = (subData.categories ?? []).flatMap(s => s.products ?? [])
    console.log(`Primera subcat (${primeraSubId}) productos: ${prods.length}`)
    if (prods[0]) console.log(`  Ejemplo: ${prods[0].display_name} — ${prods[0].price_instructions?.unit_price}€`)
  }
}
