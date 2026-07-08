-- Función RPC para insertar o incrementar votos en aprendizaje_picker de forma atómica
CREATE OR REPLACE FUNCTION incrementar_voto_picker(
  p_ingrediente text,
  p_nombre      text,
  p_precio      numeric,
  p_foto        text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO aprendizaje_picker (ingrediente, producto_nombre, producto_precio, producto_foto, votos, updated_at)
  VALUES (p_ingrediente, p_nombre, p_precio, p_foto, 1, now())
  ON CONFLICT (ingrediente, producto_nombre)
  DO UPDATE SET
    votos = aprendizaje_picker.votos + 1,
    producto_precio = COALESCE(p_precio, aprendizaje_picker.producto_precio),
    producto_foto   = COALESCE(p_foto,   aprendizaje_picker.producto_foto),
    updated_at      = now();
END;
$$;

GRANT EXECUTE ON FUNCTION incrementar_voto_picker TO authenticated;
