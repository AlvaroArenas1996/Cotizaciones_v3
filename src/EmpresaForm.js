import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function EmpresaForm({ userId, tipoEmpresa, onSuccess }) {
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('[EmpresaForm] userId:', userId);
    console.log('[EmpresaForm] nombre:', nombre);
    console.log('[EmpresaForm] rut:', rut);
    console.log('[EmpresaForm] direccion:', direccion);
    console.log('[EmpresaForm] tipoEmpresa:', tipoEmpresa);
    const payload = {
      id: userId,
      nombre,
      rut,
      direccion,
      tipo_empresa: tipoEmpresa,
    };
    // Elimina nombre_producto si accidentalmente se incluyera
    delete payload.nombre_producto;
    console.log('[EmpresaForm] payload a insertar:', payload);
    try {
      const { data, error, status, statusText } = await supabase.from('empresas').upsert([
        payload
      ]);
      console.log('[EmpresaForm] respuesta supabase:', { data, error, status, statusText });
      setLoading(false);
      if (error) {
        console.error('[EmpresaForm] ERROR SUPABASE:', error, error.message, error.details, error.hint);
        setError('Error al guardar datos de empresa: ' + error.message + (error.details ? ' Detalles: ' + error.details : ''));
      } else {
        // Guardar el id de empresa en localStorage para toda la app
        if (payload.id) {
          localStorage.setItem('empresa_id', payload.id);
          console.log('[EmpresaForm] Guardado en localStorage empresa_id:', payload.id);
        }
        onSuccess();
        // --- NUEVO: Insertar todos los productos en precios_actualizados con id_tinta=6 si no tienen tintas asociadas ---
        try {
          // 1. Obtener todos los productos
          const { data: productos, error: productosError } = await supabase.from('productos').select('*');
          if (!productosError && productos && productos.length > 0) {
            // 2. Obtener relación productos_tintas
            const { data: productosTintas, error: ptError } = await supabase.from('productos_tintas').select('id_producto, id_tinta');
            // 3. Para cada producto, verificar si tiene tintas asociadas
            const bulkPayload = [];
            for (const prod of productos) {
              const tintasAsociadas = productosTintas?.filter(pt => pt.id_producto === prod.id_producto) || [];
              if (tintasAsociadas.length === 0) {
                // Sin tintas: insertar con id_tinta=6 y habilitado: false
                bulkPayload.push({
                  id_empresa: payload.id,
                  id_producto: prod.id_producto,
                  id_tinta: 6,
                  valor_actualizado: prod.precio ?? 1,
                  updated_at: new Date().toISOString(),
                  nombre_empresa: payload.nombre,
                  habilitado: false // DESHABILITADO POR DEFECTO
                });
              } else {
                // Con tintas: insertar uno por cada tinta asociada, todos deshabilitados por defecto
                for (const tinta of tintasAsociadas) {
                  bulkPayload.push({
                    id_empresa: payload.id,
                    id_producto: prod.id_producto,
                    id_tinta: tinta.id_tinta,
                    valor_actualizado: prod.precio ?? 1,
                    updated_at: new Date().toISOString(),
                    nombre_empresa: payload.nombre,
                    habilitado: false // DESHABILITADO POR DEFECTO
                  });
                }
              }
            }
            if (bulkPayload.length > 0) {
              const { error: preciosError } = await supabase.from('precios_actualizados').upsert(bulkPayload, { onConflict: ['id_empresa', 'id_producto', 'id_tinta'] });
              if (preciosError) {
                console.error('[EmpresaForm] Error al insertar precios_actualizados masivo:', preciosError);
              }
            }
          }
        } catch (e) {
          console.error('[EmpresaForm] EXCEPCION al insertar precios_actualizados masivo:', e);
        }
        // --- FIN NUEVO ---
      }
    } catch (e) {
      setLoading(false);
      console.error('[EmpresaForm] EXCEPCION:', e);
      setError('Excepción inesperada al guardar datos de empresa: ' + (e.message || e));
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      <h4>Datos de la empresa</h4>
      <input
        type="text"
        placeholder="Nombre de la empresa"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="RUT (opcional)"
        value={rut}
        onChange={e => setRut(e.target.value)}
      />
      <input
        type="text"
        placeholder="Dirección (opcional)"
        value={direccion}
        onChange={e => setDireccion(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar datos de empresa'}
      </button>
      {error && <div className="auth-error">{error}</div>}
    </form>
  );
}

export default EmpresaForm;
