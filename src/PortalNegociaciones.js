import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Tabla de negociaciones para empresa o cliente
export default function PortalNegociaciones({ negociacion, usuario }) {
  const [negociaciones, setNegociaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatAbierto, setChatAbierto] = useState(null); // { negociacion, mensajes }
  const [mensajes, setMensajes] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Traer negociaciones según rol
  useEffect(() => {
    async function fetchNegociaciones() {
      setLoading(true);
      let data = [];
      if (usuario?.id) {
        if (usuario.role === 'empresa') {
          // Empresas: negociaciones donde la empresa es parte
          const { data: ventas } = await supabase
            .from('ventas')
            .select('id, cotizacion_id, empresa_id, monto_total, estado, cotizaciones (numero_cotizacion, cliente_id), empresas (nombre)')
            .eq('empresa_id', usuario.id)
            .eq('estado', 'pendiente');
          data = ventas || [];
        } else {
          // Clientes: negociaciones de sus cotizaciones pagadas
          const { data: ventas } = await supabase
            .from('ventas')
            .select('id, cotizacion_id, empresa_id, monto_total, estado, cotizaciones (numero_cotizacion, cliente_id), empresas (nombre)')
            .eq('cotizaciones.cliente_id', usuario.id)
            .eq('estado', 'pendiente');
          data = ventas || [];
        }
      }
      setNegociaciones(data);
      setLoading(false);
    }
    fetchNegociaciones();
  }, [usuario]);

  // Abrir chat de una negociación
  const handleAbrirChat = async (neg) => {
    // Aquí podrías traer mensajes de supabase
    setChatAbierto({ negociacion: neg, mensajes: [] });
    setMensajes([]);
    setMensaje('');
    setAdjunto(null);
  };

  // Simulación de envío de mensaje
  const handleEnviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setMensajes(prev => [...prev, {
      usuario: usuario?.id,
      texto: mensaje,
      archivo: adjunto ? adjunto.name : null,
      fecha: new Date().toISOString(),
      esPropio: true
    }]);
    setMensaje('');
    setAdjunto(null);
    setEnviando(false);
  };

  if (loading) return <div>Cargando negociaciones...</div>;

  if (!chatAbierto) {
    return (
      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#19223a', marginBottom: 20 }}>
          Negociaciones Activas
        </h2>
        <table style={{ width: '100%', background: '#fff', borderRadius: 10, borderCollapse: 'collapse', boxShadow: '0 1px 8px #0001', marginBottom: 30 }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Cotización</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Empresa</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Monto</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Estado</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {negociaciones.length === 0 && (
              <tr><td colSpan={5} style={{ color: '#888', textAlign: 'center', padding: 26 }}>No hay negociaciones activas.</td></tr>
            )}
            {negociaciones.map((neg, idx) => (
              <tr key={neg.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>{neg.cotizaciones && typeof neg.cotizaciones === 'object' && neg.cotizaciones.numero_cotizacion && neg.cotizaciones.numero_cotizacion !== '' ? neg.cotizaciones.numero_cotizacion : <span style={{ color: '#e74c3c', fontStyle: 'italic' }}>Sin número</span>}</td>
                <td style={{ padding: 8 }}>{neg.empresas?.nombre || neg.empresa_id}</td>
                <td style={{ padding: 8 }}>{neg.monto_total?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })}</td>
                <td style={{ padding: 8 }}>{neg.estado}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }} onClick={() => handleAbrirChat(neg)}>
                    Abrir chat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Vista de chat de negociación
  const { negociacion: neg } = chatAbierto;
  const numeroCot = neg.cotizaciones && typeof neg.cotizaciones === 'object' && neg.cotizaciones.numero_cotizacion && neg.cotizaciones.numero_cotizacion !== ''
    ? neg.cotizaciones.numero_cotizacion
    : (neg.numero_cotizacion ? neg.numero_cotizacion : (neg.cotizacion_id || 'Sin número'));
  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <button style={{ marginBottom: 14, background: '#eee', border: 'none', borderRadius: 5, padding: '7px 14px', cursor: 'pointer' }} onClick={() => setChatAbierto(null)}>← Volver a negociaciones</button>
      <h2 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#19223a', marginBottom: 20 }}>
        Chat de Negociación
      </h2>
      <div style={{ marginBottom: 18 }}>
        <b>Cotización:</b> {numeroCot}
      </div>
      <div style={{ marginBottom: 18 }}>
        <b>Empresa:</b> {neg.empresas?.nombre || neg.empresa_id}
      </div>
      <div style={{ background: '#f5f7fa', borderRadius: 10, padding: 24, minHeight: 160, color: '#222', marginBottom: 24 }}>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
          {mensajes.length === 0 && <div style={{ color: '#888', fontStyle: 'italic' }}>No hay mensajes aún.</div>}
          {mensajes.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: 10, textAlign: msg.esPropio ? 'right' : 'left' }}>
              <span style={{ background: msg.esPropio ? '#1976d2' : '#eee', color: msg.esPropio ? '#fff' : '#222', borderRadius: 8, padding: '7px 12px', display: 'inline-block', maxWidth: '70%' }}>
                {msg.texto}
                {msg.archivo && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span role="img" aria-label="adjunto">📎</span> {msg.archivo}
                  </div>
                )}
              </span>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{new Date(msg.fecha).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <form onSubmit={handleEnviar} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 5, border: '1px solid #ccc' }}
            required
          />
          <input
            type="file"
            onChange={e => setAdjunto(e.target.files[0])}
            style={{ display: 'none' }}
            id="adjuntofile"
          />
          <label htmlFor="adjuntofile" style={{ background: '#eee', border: 'none', borderRadius: 5, padding: '7px 10px', cursor: 'pointer', fontSize: 17, marginBottom: 0 }} title="Adjuntar archivo">
            📎
          </label>
          <button type="submit" disabled={enviando || !mensaje} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 18px', fontWeight: 600, fontSize: 15, cursor: enviando ? 'not-allowed' : 'pointer' }}>
            Enviar
          </button>
        </form>
        {adjunto && (
          <div style={{ fontSize: 13, color: '#1976d2', marginTop: 8 }}>
            Archivo seleccionado: {adjunto.name}
          </div>
        )}
      </div>
    </div>
  );
}
