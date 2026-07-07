-- Tabla de aprendizaje colectivo del picker de productos Mercadona.
-- Cuando un usuario elige un producto para un ingrediente IA, se registra aquí
-- y todos los usuarios ven esas asociaciones ordenadas por votos.
CREATE TABLE IF NOT EXISTS aprendizaje_picker (
  ingrediente      text    NOT NULL,  -- nombre normalizado del ingrediente (minúsculas, sin acentos)
  producto_nombre  text    NOT NULL,
  producto_precio  numeric,
  producto_foto    text,
  votos            integer NOT NULL DEFAULT 1,
  updated_at       timestamptz DEFAULT now(),
  PRIMARY KEY (ingrediente, producto_nombre)
);

ALTER TABLE aprendizaje_picker ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer
CREATE POLICY "picker_read" ON aprendizaje_picker
  FOR SELECT TO authenticated USING (true);

-- Todos los usuarios autenticados pueden insertar (upsert desde cliente)
CREATE POLICY "picker_insert" ON aprendizaje_picker
  FOR INSERT TO authenticated WITH CHECK (true);

-- Todos los usuarios autenticados pueden actualizar (incrementar votos)
CREATE POLICY "picker_update" ON aprendizaje_picker
  FOR UPDATE TO authenticated USING (true);
