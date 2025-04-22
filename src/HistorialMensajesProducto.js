import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function HistorialMensajesProducto({ cotizacionId, productoId, onVolver, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMensajes() {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('detalle_producto_cliente')
        .select('id, mensaje, usuario_id, fecha, archivo_url')
        .eq('cotizacion_id', cotizacionId)
        .eq('producto_id', productoId)
        .order('fecha', { ascending: true });
      if (error) setError('Error al cargar mensajes: ' + error.message);
      if (!error) setMensajes(data || []);
      setLoading(false);
    }
    fetchMensajes();
  }, [cotizacionId, productoId]);

  const handleEnviarMensaje = async () => {
    setSubiendo(true);
    setError('');
    let archivoUrl = null;
    if (archivo) {
      const nombreArchivo = `${cotizacionId}_${productoId}_${Date.now()}_${archivo.name}`;
      const { data, error: uploadError } = await supabase.storage.from('archivos-mensajes').upload(nombreArchivo, archivo);
      if (uploadError) {
        setError('Error al subir archivo: ' + uploadError.message);
        setSubiendo(false);
        return;
      }
      if (data) {
        const { data: urlData, error: urlError } = await supabase.storage.from('archivos-mensajes').getPublicUrl(nombreArchivo);
        if (urlError) {
          setError('Error al obtener URL pública del archivo: ' + urlError.message);
          setSubiendo(false);
          return;
        }
        archivoUrl = urlData?.publicUrl;
      }
    }
    const { error: insertError } = await supabase.from('detalle_producto_cliente').insert({
      cotizacion_id: cotizacionId,
      producto_id: productoId,
      mensaje: nuevoMensaje,
      usuario_id: usuario?.id,
      fecha: new Date().toISOString(),
      archivo_url: archivoUrl,
    });
    if (insertError) {
      setError('Error al enviar mensaje: ' + insertError.message);
      setSubiendo(false);
      return;
    }
    setNuevoMensaje('');
    setArchivo(null);
    setSubiendo(false);
    // Refrescar mensajes
    const { data, error: fetchError } = await supabase
      .from('detalle_producto_cliente')
      .select('id, mensaje, usuario_id, fecha, archivo_url')
      .eq('cotizacion_id', cotizacionId)
      .eq('producto_id', productoId)
      .order('fecha', { ascending: true });
    if (fetchError) setError('Error al recargar mensajes: ' + fetchError.message);
    setMensajes(data || []);
  };

  return (
    <div style={{ padding: 40, maxWidth: 650, margin: '0 auto' }}>
      <button onClick={onVolver} style={{ marginBottom: 24, background: '#eee', border: 'none', borderRadius: 5, padding: '7px 14px', cursor: 'pointer', fontSize: 16 }}>← Volver</button>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#19223a', marginBottom: 20 }}>
        Historial de mensajes
      </h2>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {loading ? <div>Cargando mensajes...</div> : (
        <div style={{ marginBottom: 24 }}>
          {mensajes.length === 0 && <div style={{ color: '#888' }}>No hay mensajes aún.</div>}
          {mensajes.map(msg => (
            <div key={msg.id} style={{ marginBottom: 16, background: '#f5f7fa', borderRadius: 7, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{msg.usuario_id === usuario?.id ? 'Tú' : msg.usuario_id}</div>
              <div style={{ margin: '6px 0 3px 0' }}>{msg.mensaje}</div>
              {msg.archivo_url && (
                <a href={msg.archivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', fontSize: 14 }}>Ver archivo adjunto</a>
              )}
              <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{msg.fecha && new Date(msg.fecha).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 6px #0001' }}>
        <textarea
          placeholder="Escribe un mensaje"
          value={nuevoMensaje}
          onChange={e => setNuevoMensaje(e.target.value)}
          style={{ width: '100%', minHeight: 60, fontSize: 15, marginBottom: 12 }}
          disabled={subiendo}
        />
        <div style={{ marginBottom: 12 }}>
          <input type="file" onChange={e => setArchivo(e.target.files[0])} disabled={subiendo} />
        </div>
        <button
          onClick={handleEnviarMensaje}
          style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 20px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          disabled={subiendo || (!nuevoMensaje && !archivo)}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
