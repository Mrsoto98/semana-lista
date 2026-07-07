-- Función atómica que verifica e incrementa el límite de generaciones en una sola
-- transacción con FOR UPDATE, eliminando la race condition TOCTOU.
-- Devuelve jsonb con { permitido, via_anuncio, generaciones_mes, generaciones_anuncio }.

CREATE OR REPLACE FUNCTION intentar_generacion(p_via_anuncio boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gens_mes              int;
  v_gens_anuncio          int;
  v_reset                 date;
  v_misma_semana          boolean;
BEGIN
  -- Bloquear la fila del usuario para evitar concurrencia
  SELECT generaciones_mes, generaciones_anuncio_semana, generaciones_reset
  INTO v_gens_mes, v_gens_anuncio, v_reset
  FROM perfiles
  WHERE usuario_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('permitido', false, 'razon', 'perfil_no_encontrado');
  END IF;

  v_misma_semana := v_reset IS NOT NULL
    AND date_trunc('week', v_reset::timestamptz) = date_trunc('week', now());

  -- Si es nueva semana, resetear contadores en memoria antes de evaluar
  IF NOT v_misma_semana THEN
    v_gens_mes     := 0;
    v_gens_anuncio := 0;
  END IF;

  -- ¿Hay generación gratuita disponible?
  IF v_gens_mes < 2 THEN
    UPDATE perfiles SET
      generaciones_mes           = v_gens_mes + 1,
      generaciones_anuncio_semana = CASE WHEN v_misma_semana THEN generaciones_anuncio_semana ELSE 0 END,
      generaciones_reset         = CURRENT_DATE
    WHERE usuario_id = auth.uid();
    RETURN jsonb_build_object(
      'permitido',           true,
      'via_anuncio',         false,
      'generaciones_mes',    v_gens_mes + 1,
      'generaciones_anuncio', CASE WHEN v_misma_semana THEN v_gens_anuncio ELSE 0 END
    );
  END IF;

  -- Sin generaciones gratuitas — ¿generación por anuncio disponible?
  IF p_via_anuncio AND COALESCE(v_gens_anuncio, 0) < 5 THEN
    UPDATE perfiles SET
      generaciones_anuncio_semana = COALESCE(v_gens_anuncio, 0) + 1,
      generaciones_reset          = CURRENT_DATE
    WHERE usuario_id = auth.uid();
    RETURN jsonb_build_object(
      'permitido',           true,
      'via_anuncio',         true,
      'generaciones_mes',    v_gens_mes,
      'generaciones_anuncio', COALESCE(v_gens_anuncio, 0) + 1
    );
  END IF;

  -- Límite alcanzado
  RETURN jsonb_build_object(
    'permitido',           false,
    'razon',               CASE WHEN p_via_anuncio THEN 'limite_anuncio' ELSE 'limite_gratuito' END,
    'generaciones_mes',    v_gens_mes,
    'generaciones_anuncio', COALESCE(v_gens_anuncio, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION intentar_generacion(boolean) TO authenticated;


-- Trigger que impide que clientes autenticados escriban directamente los contadores.
-- Las funciones SECURITY DEFINER (como intentar_generacion) corren como postgres
-- y pasan el filtro. Los clientes autenticados ven sus cambios en esas columnas
-- silenciosamente ignorados (el UPDATE devuelve 200 OK pero el valor no cambia).

CREATE OR REPLACE FUNCTION protect_generation_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' AND (
    NEW.generaciones_mes              IS DISTINCT FROM OLD.generaciones_mes OR
    NEW.generaciones_reset            IS DISTINCT FROM OLD.generaciones_reset OR
    NEW.generaciones_anuncio_semana   IS DISTINCT FROM OLD.generaciones_anuncio_semana
  ) THEN
    -- Restaurar silenciosamente los valores protegidos
    NEW.generaciones_mes            := OLD.generaciones_mes;
    NEW.generaciones_reset          := OLD.generaciones_reset;
    NEW.generaciones_anuncio_semana := OLD.generaciones_anuncio_semana;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_generation_counters ON perfiles;
CREATE TRIGGER trg_protect_generation_counters
BEFORE UPDATE ON perfiles
FOR EACH ROW EXECUTE FUNCTION protect_generation_counters();


-- Trigger que genera codigo_usuario server-side con mayor entropía (8 dígitos,
-- 90M combinaciones) en lugar de 6 dígitos generados con Math.random() en cliente.
-- Solo actúa cuando el codigo es NULL o vacío (no modifica usuarios existentes).

CREATE OR REPLACE FUNCTION generate_codigo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_exists boolean;
BEGIN
  IF NEW.codigo_usuario IS NULL OR NEW.codigo_usuario = '' THEN
    LOOP
      v_codigo := LPAD(floor(random() * 9000 + 1000)::text, 4, '0') || '-' ||
                  LPAD(floor(random() * 10000)::text, 4, '0');
      SELECT EXISTS(SELECT 1 FROM usuarios WHERE codigo_usuario = v_codigo) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    NEW.codigo_usuario := v_codigo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_codigo_usuario ON usuarios;
CREATE TRIGGER trg_generate_codigo_usuario
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION generate_codigo_usuario();
