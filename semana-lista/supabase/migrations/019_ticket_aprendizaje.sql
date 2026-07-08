-- Tabla de aprendizaje de productos de ticket
CREATE TABLE IF NOT EXISTS ticket_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto_ticket text NOT NULL,       -- texto original del ticket normalizado
  nombre_es text NOT NULL,          -- nombre genérico en español
  nombre_ca text,                   -- nombre en catalán
  nombre_mercadona text,            -- nombre exacto del catálogo Mercadona
  precio numeric(8,2),              -- precio en el ticket
  unidad text,                      -- L, kg, ud, g, cl...
  precio_unidad numeric(8,2),       -- precio por kg o litro si está disponible
  confirmaciones integer DEFAULT 1, -- cuántas veces usuarios lo confirmaron
  created_at timestamptz DEFAULT now()
);

-- Índice único sobre texto normalizado para buscar y hacer ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS ticket_productos_texto_idx
  ON ticket_productos (lower(trim(texto_ticket)));

ALTER TABLE ticket_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_read" ON ticket_productos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ticket_insert" ON ticket_productos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ticket_update" ON ticket_productos
  FOR UPDATE TO authenticated USING (true);

-- Función para upsert con incremento de confirmaciones
CREATE OR REPLACE FUNCTION guardar_ticket_producto(
  p_texto_ticket text,
  p_nombre_es text,
  p_nombre_ca text DEFAULT NULL,
  p_nombre_mercadona text DEFAULT NULL,
  p_precio numeric DEFAULT NULL,
  p_unidad text DEFAULT NULL,
  p_precio_unidad numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ticket_productos
    (texto_ticket, nombre_es, nombre_ca, nombre_mercadona, precio, unidad, precio_unidad)
  VALUES
    (lower(trim(p_texto_ticket)), p_nombre_es, p_nombre_ca, p_nombre_mercadona,
     p_precio, p_unidad, p_precio_unidad)
  ON CONFLICT (lower(trim(texto_ticket)))
  DO UPDATE SET
    confirmaciones  = ticket_productos.confirmaciones + 1,
    nombre_es       = EXCLUDED.nombre_es,
    nombre_ca       = COALESCE(EXCLUDED.nombre_ca, ticket_productos.nombre_ca),
    nombre_mercadona = COALESCE(EXCLUDED.nombre_mercadona, ticket_productos.nombre_mercadona),
    precio          = EXCLUDED.precio,
    unidad          = COALESCE(EXCLUDED.unidad, ticket_productos.unidad),
    precio_unidad   = COALESCE(EXCLUDED.precio_unidad, ticket_productos.precio_unidad);
END;
$$;

GRANT EXECUTE ON FUNCTION guardar_ticket_producto TO authenticated;
