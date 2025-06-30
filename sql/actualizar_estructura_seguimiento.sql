-- Eliminar tablas antiguas si existen
DROP TABLE IF EXISTS public.seguimiento_cotizacion;
DROP TABLE IF EXISTS public.seguimiento_produccion;

-- Crear tabla de etapas de producción
CREATE TABLE IF NOT EXISTS public.etapas_produccion (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL,
    color TEXT NOT NULL,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT etapas_produccion_orden_key UNIQUE (orden)
);

-- Insertar datos iniciales
INSERT INTO public.etapas_produccion (id, nombre, descripcion, orden, color, activa, created_at, updated_at)
VALUES 
(1, 'Diseño', 'Etapa de diseño del producto', 1, '#3B82F6', true, NOW(), NOW()),
(2, 'Impresión', 'Etapa de impresión del material', 2, '#8B5CF6', true, NOW(), NOW()),
(3, 'Armado', 'Etapa de armado del producto', 3, '#10B981', true, NOW(), NOW()),
(4, 'Confección', 'Etapa de confección del producto', 4, '#F59E0B', true, NOW(), NOW()),
(5, 'Instalación', 'Etapa de instalación del producto', 5, '#EC4899', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    orden = EXCLUDED.orden,
    color = EXCLUDED.color,
    activa = EXCLUDED.activa,
    updated_at = NOW();

-- Crear tabla para el seguimiento de producción de cada detalle de cotización
CREATE TABLE IF NOT EXISTS public.seguimiento_produccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    cotizacion_detalle_id UUID NOT NULL REFERENCES public.cotizacion_detalle(id) ON DELETE CASCADE,
    etapa_id INTEGER NOT NULL REFERENCES public.etapas_produccion(id),
    estado BOOLEAN DEFAULT false,
    usuario_id UUID REFERENCES auth.users(id),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT,
    CONSTRAINT seguimiento_produccion_unique UNIQUE (cotizacion_detalle_id, etapa_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_seguimiento_produccion_cotizacion ON public.seguimiento_produccion(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_produccion_detalle ON public.seguimiento_produccion(cotizacion_detalle_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_produccion_etapa ON public.seguimiento_produccion(etapa_id);

-- Crear función para actualizar automáticamente el campo updated_at
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear o reemplazar la función de actualización de timestamp
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para actualizar automáticamente los timestamps (solo si no existen)
DO $$
BEGIN
    -- Verificar y crear trigger para etapas_produccion
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'actualizar_etapas_timestamp' 
        AND tgrelid = 'public.etapas_produccion'::regclass
    ) THEN
        CREATE TRIGGER actualizar_etapas_timestamp
        BEFORE UPDATE ON public.etapas_produccion
        FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
    END IF;

    -- Verificar y crear trigger para seguimiento_produccion
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'actualizar_seguimiento_timestamp' 
        AND tgrelid = 'public.seguimiento_produccion'::regclass
    ) THEN
        CREATE TRIGGER actualizar_seguimiento_timestamp
        BEFORE UPDATE ON public.seguimiento_produccion
        FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
    END IF;
END $$;

-- Otorgar permisos
GRANT SELECT ON public.etapas_produccion TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seguimiento_produccion TO authenticated;
