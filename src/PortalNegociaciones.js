import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import DetalleNegociacion from './DetalleNegociacion';

// Tabla de negociaciones para empresa o cliente
export default function PortalNegociaciones({ negociacion, usuario }) {
  const [negociaciones, setNegociaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalleAbierto, setDetalleAbierto] = useState(null); // cotizacionId
  const [subiendo, setSubiendo] = useState(false);

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

  // Función para abrir detalle
  const handleVerDetalle = (cotizacionId) => {
    setDetalleAbierto(cotizacionId);
  };
  // Función para volver
  const handleVolver = () => {
    setDetalleAbierto(null);
  };

  if (loading) return <div>Cargando negociaciones...</div>;

  if (detalleAbierto) {
    return <DetalleNegociacion cotizacionId={detalleAbierto} onVolver={handleVolver} usuario={usuario} />;
  }

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
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Accion</th>
          </tr>
        </thead>
        <tbody>
          {negociaciones.length === 0 && (
            <tr><td colSpan={4} style={{ color: '#888', textAlign: 'center', padding: 26 }}>No hay negociaciones activas.</td></tr>
          )}
          {negociaciones.map((neg, idx) => (
            <tr key={neg.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 8 }}>{neg.cotizaciones && typeof neg.cotizaciones === 'object' && neg.cotizaciones.numero_cotizacion && neg.cotizaciones.numero_cotizacion !== '' ? neg.cotizaciones.numero_cotizacion : <span style={{ color: '#e74c3c', fontStyle: 'italic' }}>Sin número</span>}</td>
              <td style={{ padding: 8 }}>{neg.empresas?.nombre || neg.empresa_id}</td>
              <td style={{ padding: 8 }}>{neg.monto_total?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })}</td>
              <td style={{ padding: 8 }}>
                <button
                  style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                  onClick={() => {
                    console.log('DEBUG: neg object', neg);
                    console.log('DEBUG: neg.cotizacion_id', neg.cotizacion_id);
                    console.log('DEBUG: neg.cotizaciones', neg.cotizaciones);
                    const cotId = neg.cotizacion_id || (neg.cotizaciones && neg.cotizaciones.id) || (neg.cotizaciones && neg.cotizaciones.cotizacion_id) || neg.id;
                    console.log('DEBUG: cotId used for detalle:', cotId);
                    handleVerDetalle(cotId);
                  }}
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
