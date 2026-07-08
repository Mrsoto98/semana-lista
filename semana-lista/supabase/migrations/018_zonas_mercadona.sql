-- ─── 018: Zonas logísticas Mercadona + precios por zona ─────────────────────
-- El catálogo maestro (productos_mercadona / mercadona.json) NO SE TOCA.
-- Esta migración solo AÑADE tablas y una columna al perfil.

-- 1. Zonas logísticas disponibles
CREATE TABLE IF NOT EXISTS public.zonas_mercadona (
  id               TEXT PRIMARY KEY,          -- 'barcelona', 'madrid', 'levante'…
  nombre           TEXT NOT NULL,
  codigo_postal_ref TEXT NOT NULL,            -- CP representativo para scraping
  activa           BOOLEAN NOT NULL DEFAULT false,  -- true = tiene datos en precios_zona
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Zona inicial que ya tenemos
INSERT INTO public.zonas_mercadona (id, nombre, codigo_postal_ref, activa) VALUES
  ('barcelona', 'Barcelona / Vilafranca',  '08720', true),
  ('madrid',    'Madrid',                  '28001', false),
  ('levante',   'Valencia / Murcia',       '46001', false),
  ('andalucia', 'Andalucía',               '41001', false),
  ('norte',     'País Vasco / Navarra',    '48001', false),
  ('canarias',  'Canarias',                '35001', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Precios y disponibilidad por zona
-- PK compuesta garantiza: un producto no puede aparecer dos veces en la misma zona
CREATE TABLE IF NOT EXISTS public.precios_zona (
  producto_id  TEXT    NOT NULL,   -- ID numérico de Mercadona como texto (ej. "9876")
  zona_id      TEXT    NOT NULL REFERENCES public.zonas_mercadona(id) ON DELETE CASCADE,
  precio       NUMERIC(10,2) NOT NULL,
  precio_ref   TEXT,               -- "3,20 €/kg" tal como devuelve la API
  disponible   BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (producto_id, zona_id)
);

CREATE INDEX IF NOT EXISTS idx_precios_zona_zona_disp
  ON public.precios_zona (zona_id, disponible)
  WHERE disponible = true;

-- 3. Columna zona_id en perfiles
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS zona_id TEXT
  REFERENCES public.zonas_mercadona(id)
  DEFAULT 'barcelona';

-- Retrocompatibilidad: asignar barcelona a todos los perfiles existentes
UPDATE public.perfiles SET zona_id = 'barcelona' WHERE zona_id IS NULL;

-- 4. RLS: precios_zona es de solo lectura para todos los usuarios autenticados
--    (los precios no son datos privados, son públicos de Mercadona)
ALTER TABLE public.precios_zona     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas_mercadona  ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer zonas y precios
CREATE POLICY "anon_read_zonas" ON public.zonas_mercadona
  FOR SELECT USING (true);

CREATE POLICY "auth_read_precios_zona" ON public.precios_zona
  FOR SELECT TO authenticated USING (true);

-- Solo service_role puede escribir (el edge function sync-precios-zona)
CREATE POLICY "service_write_precios_zona" ON public.precios_zona
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_write_zonas" ON public.zonas_mercadona
  FOR ALL TO service_role USING (true);
