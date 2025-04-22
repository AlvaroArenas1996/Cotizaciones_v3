-- Agrega columna 'role' a profiles con valor por defecto 'cliente'
ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'cliente';

-- Ejemplo de tabla empresas (opcional, para más datos de empresa)
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY references profiles(id) on delete cascade,
  nombre text NOT NULL,
  rut text,
  direccion text,
  tipo_empresa text NOT NULL -- 'publicidad' o 'insumos'
);
