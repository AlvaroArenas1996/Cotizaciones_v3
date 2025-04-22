-- 1. Crear tablas

CREATE TABLE IF NOT EXISTS cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES profiles(id),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT CHECK (estado IN ('pendiente a publicar', 'publicado')) NOT NULL
);

CREATE TABLE IF NOT EXISTS cotizacion_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id_producto),
    alto NUMERIC(8,2) NOT NULL,
    ancho NUMERIC(8,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS respuestas_cotizacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    monto NUMERIC(12,2) NOT NULL
);

-- 2. Habilitar RLS

ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_cotizacion ENABLE ROW LEVEL SECURITY;

-- 3. Crear policies

-- Cotizaciones
CREATE POLICY cliente_cotizaciones_select ON cotizaciones
    FOR SELECT
    USING (cliente_id = auth.uid());

CREATE POLICY cliente_cotizaciones_update ON cotizaciones
    FOR UPDATE
    USING (cliente_id = auth.uid());

CREATE POLICY cliente_cotizaciones_delete ON cotizaciones
    FOR DELETE
    USING (cliente_id = auth.uid());

CREATE POLICY empresas_ver_publicadas_select ON cotizaciones
    FOR SELECT
    USING (estado = 'publicado');

-- Respuestas a cotizaciones
CREATE POLICY empresas_responder_insert ON respuestas_cotizacion
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cotizaciones c WHERE c.id = cotizacion_id AND c.estado = 'publicado'
        )
    );

CREATE POLICY empresa_ver_respuestas_select ON respuestas_cotizacion
    FOR SELECT
    USING (empresa_id = auth.uid());

CREATE POLICY cliente_ver_respuestas_select ON respuestas_cotizacion
    FOR SELECT
    USING (
        cotizacion_id IN (SELECT id FROM cotizaciones WHERE cliente_id = auth.uid())
    );

-- Detalle de cotización
CREATE POLICY cliente_cotizacion_detalle_select ON cotizacion_detalle
    FOR SELECT
    USING (
        cotizacion_id IN (SELECT id FROM cotizaciones WHERE cliente_id = auth.uid())
    );

CREATE POLICY cliente_cotizacion_detalle_update ON cotizacion_detalle
    FOR UPDATE
    USING (
        cotizacion_id IN (SELECT id FROM cotizaciones WHERE cliente_id = auth.uid())
    );

CREATE POLICY cliente_cotizacion_detalle_delete ON cotizacion_detalle
    FOR DELETE
    USING (
        cotizacion_id IN (SELECT id FROM cotizaciones WHERE cliente_id = auth.uid())
    );