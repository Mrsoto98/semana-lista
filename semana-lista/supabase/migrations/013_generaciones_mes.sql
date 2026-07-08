-- Contador mensual de generaciones de recetas por usuario
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS generaciones_mes   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generaciones_reset date;

-- Reset automático el 1 de cada mes vía función + cron (pg_cron)
CREATE OR REPLACE FUNCTION reset_generaciones_mes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE perfiles
  SET generaciones_mes = 0,
      generaciones_reset = CURRENT_DATE
  WHERE generaciones_reset IS NULL
     OR date_trunc('month', generaciones_reset) < date_trunc('month', CURRENT_DATE);
$$;
