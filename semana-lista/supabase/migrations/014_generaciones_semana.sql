-- Cambia el sistema de límite mensual a semanal (2 gratis/semana + bonus por anuncio)
-- Reutiliza generaciones_mes como generaciones_semana (reset cada lunes)
-- Añade columna para rastrear si el usuario ya vio un anuncio esta semana

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS generaciones_anuncio_semana integer NOT NULL DEFAULT 0;

-- Reset automático semanal (cada lunes): se ejecuta desde cliente o edge function
CREATE OR REPLACE FUNCTION reset_generaciones_semana()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE perfiles
  SET generaciones_mes = 0,
      generaciones_anuncio_semana = 0,
      generaciones_reset = CURRENT_DATE
  WHERE generaciones_reset IS NULL
     OR date_trunc('week', generaciones_reset) < date_trunc('week', CURRENT_DATE);
$$;
