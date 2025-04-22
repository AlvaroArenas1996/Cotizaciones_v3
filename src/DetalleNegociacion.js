import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import HistorialMensajesProducto from './HistorialMensajesProducto';

export default function DetalleNegociacion({ cotizacionId, onVolver, usuario }) {
  const [productos, setProductos] = useState([]);
  const [mensajes, setMensajes] = useState({}); // { producto_id: { mensaje, usuario_id, fecha } }
  const [mensajesEdit, setMensajesEdit] = useState({}); // { producto_id: mensaje }
  const [guardando, setGuardando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productoMensajes, setProductoMensajes] = useState(null); // producto_id activo para historial

  useEffect(() => {
    async function fetchDetalle() {
      setLoading(true);
      // Traer productos del detalle
      const { data: detalles, error } = await supabase
        .from('cotizacion_detalle')
        .select('cotizacion_id, producto_id, alto, ancho')
        .eq('cotizacion_id', cotizacionId);
      if (error) {
        console.error('Error al obtener cotizacion_detalle:', error);
        setProductos([]);
        setLoading(false);
        return;
      }
      // Traer nombres de productos
      const productoIds = (detalles || []).map(d => d.producto_id);
      let nombresMap = {};
      if (productoIds.length > 0) {
        const { data: productosDb } = await supabase
          .from('productos')
          .select('id_producto, nombre_producto')
          .in('id_producto', productoIds);
        (productosDb || []).forEach(p => {
          nombresMap[p.id_producto] = p.nombre_producto;
        });
      }
      // Combinar detalles con nombre
      const detallesConNombre = (detalles || []).map(det => ({
        ...det,
        nombre_producto: nombresMap[det.producto_id] || det.producto_id
      }));
      setProductos(detallesConNombre);
      // Traer mensajes previos
      const { data: mensajesDb } = await supabase
        .from('detalle_producto_cliente')
        .select('producto_id, mensaje, usuario_id, fecha')
        .eq('cotizacion_id', cotizacionId);
      const mensajesMap = {};
      (mensajesDb || []).forEach(m => {
        mensajesMap[m.producto_id] = m;
      });
      setMensajes(mensajesMap);
      setMensajesEdit({});
      setLoading(false);
    }
    fetchDetalle();
  }, [cotizacionId]);

  const handleMensajeChange = (productoId, value) => {
    setMensajesEdit(prev => ({ ...prev, [productoId]: value }));
  };

  const handleGuardarMensaje = async (productoId) => {
    setGuardando(true);
    const mensaje = mensajesEdit[productoId] || '';
    await supabase.from('detalle_producto_cliente').upsert({
      cotizacion_id: cotizacionId,
      producto_id: productoId,
      mensaje,
      usuario_id: usuario?.id,
      fecha: new Date().toISOString(),
    });
    // Refrescar mensajes
    const { data: mensajesDb } = await supabase
      .from('detalle_producto_cliente')
      .select('producto_id, mensaje, usuario_id, fecha')
      .eq('cotizacion_id', cotizacionId);
    const mensajesMap = {};
    (mensajesDb || []).forEach(m => {
      mensajesMap[m.producto_id] = m;
    });
    setMensajes(mensajesMap);
    setMensajesEdit(prev => ({ ...prev, [productoId]: '' }));
    setGuardando(false);
  };

  if (loading) return <div style={{ padding: 40 }}>Cargando detalle...</div>;

  if (productoMensajes) {
    return (
      <HistorialMensajesProducto
        cotizacionId={cotizacionId}
        productoId={productoMensajes}
        onVolver={() => setProductoMensajes(null)}
        usuario={usuario}
      />
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 750, margin: '0 auto' }}>
      <button onClick={onVolver} style={{ marginBottom: 24, background: '#eee', border: 'none', borderRadius: 5, padding: '7px 14px', cursor: 'pointer', fontSize: 16 }}>← Volver</button>
      <h2 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#19223a', marginBottom: 20 }}>
        Detalle de Cotización
      </h2>
      <table style={{ width: '100%', background: '#fff', borderRadius: 10, borderCollapse: 'collapse', boxShadow: '0 1px 8px #0001', marginBottom: 30 }}>
        <thead>
          <tr style={{ background: '#f5f7fa' }}>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Producto</th>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Dimensiones</th>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Valor</th>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((prod, idx) => (
            <tr key={prod.producto_id + '-' + prod.alto + '-' + prod.ancho + '-' + idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 8 }}>{prod.nombre_producto}</td>
              <td style={{ padding: 8 }}>{prod.ancho} x {prod.alto}</td>
              <td style={{ padding: 8 }}>{prod.valor || '-'}</td>
              <td style={{ padding: 8, minWidth: 180 }}>
                <button
                  style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => setProductoMensajes(prod.producto_id)}
                >
                  Diseño Gráfico
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
