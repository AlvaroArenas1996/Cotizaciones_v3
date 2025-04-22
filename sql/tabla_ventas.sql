-- Tabla de ventas preparada para split payments (Mercado Pago)
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    monto_total NUMERIC(12,2) NOT NULL,          -- Monto total de la venta
    monto_empresa NUMERIC(12,2) NOT NULL,        -- Monto que recibe la empresa (split)
    monto_comision NUMERIC(12,2) NOT NULL,       -- Comisión de la plataforma
    estado TEXT DEFAULT 'pendiente',             -- pendiente, pagada, cancelada, etc.
    respuesta_id UUID REFERENCES respuestas_cotizacion(id),
    mp_payment_id TEXT,                          -- ID de pago Mercado Pago
    mp_payment_status TEXT,                      -- Estado del pago en Mercado Pago
    mp_raw_response JSONB                        -- Respuesta completa de Mercado Pago (opcional, para debugging/auditoría)
);
