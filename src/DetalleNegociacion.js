import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import HistorialMensajesProducto from './HistorialMensajesProducto';

export default function DetalleNegociacion({ cotizacionId, onVolver, usuario }) {
  const [productos, setProductos] = useState([]);
  const [mensajes, setMensajes] = useState({}); // { cotizacion_detalle_id: [{ mensaje, usuario_id, fecha }] }
  const [mensajesEdit, setMensajesEdit] = useState({}); // { cotizacion_detalle_id: mensaje }
  const [guardando, setGuardando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productoMensajes, setProductoMensajes] = useState(null); // cotizacion_detalle_id activo para historial
  const [nuevosMensajes, setNuevosMensajes] = useState({});

  useEffect(() => {
    async function fetchDetalle() {
      setLoading(true);
      // Traer productos del detalle
      const { data: detalles, error } = await supabase
        .from('cotizacion_detalle')
        .select('id, cotizacion_id, producto_id, alto, ancho')
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
        .select('cotizacion_detalle_id, mensaje, usuario_id, fecha')
        .eq('cotizacion_id', cotizacionId);
      // Agrupar mensajes por cotizacion_detalle_id como array
      const mensajesMap = {};
      (mensajesDb || []).forEach(m => {
        if (!mensajesMap[m.cotizacion_detalle_id]) mensajesMap[m.cotizacion_detalle_id] = [];
        mensajesMap[m.cotizacion_detalle_id].push(m);
      });
      setMensajes(mensajesMap);
      setMensajesEdit({});
      setLoading(false);
    }
    fetchDetalle();
  }, [cotizacionId]);

  useEffect(() => {
    if (!cotizacionId || !usuario?.id) return;
    const key = `mensajes_leidos_${cotizacionId}_ALL_${usuario.id}`;
    localStorage.setItem(key, new Date().toISOString());
  }, [cotizacionId, usuario]);

  // Optimización: checkMensajesNuevos ahora hace una sola consulta para todos los productos
  async function checkMensajesNuevos() {
    let nuevos = {};
    if (!productos.length) {
      setNuevosMensajes({});
      return;
    }
    const detIds = productos.map(prod => prod.id);
    const { data: mensajes } = await supabase
      .from('detalle_producto_cliente')
      .select('id, cotizacion_detalle_id, usuario_id, fecha')
      .eq('cotizacion_id', cotizacionId)
      .in('cotizacion_detalle_id', detIds)
      .neq('usuario_id', usuario?.id);
    for (const prod of productos) {
      const key = `mensajes_leidos_${cotizacionId}_${prod.id}_${usuario?.id}`;
      let ultimaLectura = localStorage.getItem(key) || '1970-01-01';
      const nuevosMensajes = (mensajes || []).filter(m =>
        m.cotizacion_detalle_id === prod.id &&
        m.fecha > ultimaLectura
      );
      nuevos[prod.id] = nuevosMensajes.length > 0;
    }
    setNuevosMensajes(nuevos);
  }

  useEffect(() => {
    if (productos.length > 0 && usuario?.id) checkMensajesNuevos();
  }, [productos, cotizacionId, usuario]);

  useEffect(() => {
    if (!cotizacionId) return;
    const channel = supabase
      .channel('mensajes-realtime-' + cotizacionId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'detalle_producto_cliente',
          filter: `cotizacion_id=eq.${cotizacionId}`,
        },
        (payload) => {
          // Cuando hay un nuevo mensaje, se chequean de nuevo
          checkMensajesNuevos();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cotizacionId, productos, usuario]);

  const handleMensajeChange = (cotizacionDetalleId, value) => {
    setMensajesEdit(prev => ({ ...prev, [cotizacionDetalleId]: value }));
  };

  const handleGuardarMensaje = async (cotizacionDetalleId) => {
    setGuardando(true);
    const mensaje = mensajesEdit[cotizacionDetalleId] || '';
    await supabase.from('detalle_producto_cliente').upsert({
      cotizacion_id: cotizacionId,
      cotizacion_detalle_id: cotizacionDetalleId,
      mensaje,
      usuario_id: usuario?.id,
      fecha: new Date().toISOString(),
    });
    // Refrescar mensajes SOLO para el producto actualizado (como array)
    const { data: mensajesDb } = await supabase
      .from('detalle_producto_cliente')
      .select('cotizacion_detalle_id, mensaje, usuario_id, fecha')
      .eq('cotizacion_id', cotizacionId)
      .eq('cotizacion_detalle_id', cotizacionDetalleId);
    setMensajes(prev => ({ ...prev, [cotizacionDetalleId]: mensajesDb || [] }));
    setMensajesEdit(prev => ({ ...prev, [cotizacionDetalleId]: '' }));
    setGuardando(false);
  };

  function handleAbrirMensajes(cotizacionDetalleId) {
    // Marca como leído en localStorage y actualiza el estado en tiempo real
    if (usuario?.id && cotizacionId && cotizacionDetalleId) {
      const key = `mensajes_leidos_${cotizacionId}_${cotizacionDetalleId}_${usuario.id}`;
      localStorage.setItem(key, new Date().toISOString());
      setNuevosMensajes(prev => ({
        ...prev,
        [cotizacionDetalleId]: false
      }));
    }
    setProductoMensajes(cotizacionDetalleId);
  }

  if (loading) return <div style={{ padding: 40 }}>Cargando detalle...</div>;

  if (productoMensajes) {
    return (
      <HistorialMensajesProducto
        cotizacionId={cotizacionId}
        cotizacionDetalleId={productoMensajes}
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
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((prod, idx) => (
            <tr key={prod.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 8 }}>{prod.nombre_producto}</td>
              <td style={{ padding: 8 }}>{prod.ancho} x {prod.alto}</td>
              <td style={{ padding: 8, minWidth: 180 }}>
                <button
                  style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => handleAbrirMensajes(prod.id)}
                >
                  Registro de Mensajes
                </button>
                <span style={{ marginLeft: 12 }}>
                  {nuevosMensajes[prod.id] ? <span style={{ color: '#e67e22', fontWeight: 600 }}>Nuevos Mensajes</span> : 'Sin mensajes nuevos'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
