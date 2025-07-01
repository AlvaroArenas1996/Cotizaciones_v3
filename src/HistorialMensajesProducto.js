import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function HistorialMensajesProducto({ cotizacionId, cotizacionDetalleId, onVolver, usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usuariosInfo, setUsuariosInfo] = useState({}); // Nuevo: para mostrar nombres
  const [productoInfo, setProductoInfo] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    async function fetchMensajes() {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('detalle_producto_cliente')
        .select('id, mensaje, usuario_id, fecha, archivo_url')
        .eq('cotizacion_id', cotizacionId)
        .eq('cotizacion_detalle_id', cotizacionDetalleId)
        .order('fecha', { ascending: true });
      if (error) setError('Error al cargar mensajes: ' + error.message);
      if (!error) setMensajes(data || []);
      setLoading(false);
    }
    fetchMensajes();
  }, [cotizacionId, cotizacionDetalleId]);

  useEffect(() => {
    async function fetchUsuarios() {
      // Obtén todos los usuario_id únicos de los mensajes
      const ids = [...new Set(mensajes.map(m => m.usuario_id).filter(Boolean))];
      if (ids.length === 0) return;
      // Buscar en profiles (incluyendo empresas)
      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, role')
        .in('id', ids);
      
      // Si falta email, buscarlo en auth.users
      let emailsAuth = {};
      const missingEmailIds = perfiles ? perfiles.filter(p => !(p.email)).map(p => p.id) : [];
      if (missingEmailIds.length > 0) {
        const { data: authUsers } = await supabase
          .schema('auth')
          .from('users')
          .select('id, email')
          .in('id', missingEmailIds);
        if (authUsers) {
          authUsers.forEach(u => { emailsAuth[u.id] = u.email; });
        }
      }
      
      // Construir mapa id -> display_name/email
      const info = {};
      if (perfiles) {
        perfiles.forEach(p => {
          info[p.id] = p.display_name || p.email || emailsAuth[p.id] || p.id;
        });
      }
      setUsuariosInfo(info);
    }
    fetchUsuarios();
  }, [mensajes]);

  useEffect(() => {
    async function fetchProducto() {
      if (!cotizacionDetalleId) return;
      // Buscar por id_producto o por id (ambos posibles)
      let { data, error } = await supabase
        .from('productos')
        .select('nombre_producto, ancho, alto')
        .eq('id_producto', cotizacionDetalleId)
        .single();
      if (error || !data) {
        // Intentar con 'id' si falla con 'id_producto'
        const { data: data2, error: error2 } = await supabase
          .from('productos')
          .select('nombre_producto, ancho, alto')
          .eq('id', cotizacionDetalleId)
          .single();
        if (!error2 && data2) setProductoInfo(data2);
      } else {
        setProductoInfo(data);
      }
    }
    fetchProducto();
  }, [cotizacionDetalleId]);

  useEffect(() => {
    async function marcarMensajesLeidos() {
      if (!cotizacionId || !cotizacionDetalleId || !usuario?.id) return;
      // Guardar en localStorage la última vez que el usuario vio los mensajes de este producto/cotización
      const key = `mensajes_leidos_${cotizacionId}_${cotizacionDetalleId}_${usuario.id}`;
      localStorage.setItem(key, new Date().toISOString());
    }
    marcarMensajesLeidos();
  }, [cotizacionId, cotizacionDetalleId, usuario]);

  const handleEnviarMensaje = async () => {
    setSubiendo(true);
    setError('');
    let archivoUrl = null;
    if (archivo) {
      const nombreArchivo = `${cotizacionId}_${cotizacionDetalleId}_${Date.now()}_${archivo.name}`;
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
      cotizacion_detalle_id: cotizacionDetalleId,
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
      .eq('cotizacion_detalle_id', cotizacionDetalleId)
      .order('fecha', { ascending: true });
    if (fetchError) setError('Error al recargar mensajes: ' + fetchError.message);
    setMensajes(data || []);
  };

  return (
    <div style={{ padding: 40, maxWidth: 650, margin: '0 auto', textAlign: 'left' }}>
      <button onClick={onVolver} style={{ marginBottom: 24, background: '#eee', border: 'none', borderRadius: 5, padding: '7px 14px', cursor: 'pointer', fontSize: 16, display: 'block', marginLeft: 0 }}>
        ← Volver
      </button>
      {productoInfo && (
        <div style={{ marginBottom: 16, background: '#f7fafc', borderRadius: 8, padding: 14, fontSize: 15, color: '#222', boxShadow: '0 1px 4px #0001', textAlign: 'left', marginLeft: 0 }}>
          <b>Producto:</b> {productoInfo.nombre_producto}<br/>
          <b>Dimensiones:</b> {productoInfo.ancho} x {productoInfo.alto} cm
        </div>
      )}
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#19223a', marginBottom: 20, textAlign: 'left', marginLeft: 0 }}>
        Historial de mensajes
      </h2>
      <div style={{ marginBottom: 20, textAlign: 'left', marginLeft: 0 }}>
        {!mostrarFormulario ? (
          <button
            onClick={() => setMostrarFormulario(true)}
            style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 20px', fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'center' }}
          >
            Escribir nuevo mensaje
          </button>
        ) : (
          <div style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 6px #0001', margin: '18px 0' }}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEnviarMensaje}
                style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 20px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                disabled={subiendo || (!nuevoMensaje && !archivo)}
              >
                Enviar
              </button>
              <button
                onClick={() => { setMostrarFormulario(false); setNuevoMensaje(''); setArchivo(null); }}
                style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 5, padding: '7px 20px', fontSize: 16, cursor: 'pointer' }}
                disabled={subiendo}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {loading ? <div>Cargando mensajes...</div> : (
        <div style={{ marginBottom: 24 }}>
          {mensajes.length === 0 && <div style={{ color: '#888' }}>No hay mensajes aún.</div>}
          {[...mensajes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(msg => {
            let nombreMostrado = msg.usuario_id === usuario?.id
              ? 'Tú'
              : (usuariosInfo[msg.usuario_id] && usuariosInfo[msg.usuario_id] !== msg.usuario_id
                ? usuariosInfo[msg.usuario_id]
                : ''
              );
            return (
              <div key={msg.id} style={{ marginBottom: 16, background: '#f5f7fa', borderRadius: 7, padding: 12, textAlign: 'left', marginLeft: 0 }}>
                <div style={{ fontWeight: 600 }}>{nombreMostrado}</div>
                <div style={{ margin: '6px 0 3px 0' }}>{msg.mensaje}</div>
                {msg.archivo_url && (
                  <a href={msg.archivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', fontSize: 14 }}>Ver archivo adjunto</a>
                )}
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{msg.fecha && new Date(msg.fecha).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
