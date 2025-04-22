import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function ResponderCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [detalles, setDetalles] = useState({});
  const [clientesInfo, setClientesInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCotizaciones = async () => {
      setLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      // Solo empresas
      const { data: empresa } = await supabase.from('empresas').select('id').eq('id', session.user.id).single();
      if (!empresa) {
        setError('Solo empresas pueden responder cotizaciones');
        setLoading(false);
        return;
      }
      // DEBUG extra: mostrar empresa logueada
      console.log('[ResponderCotizaciones] Empresa logueada:', empresa);
      // DEBUG extra: consulta directa a cotizaciones relacionadas con respuestas asignadas
      const { data: cotDirectas, error: errorDirectas } = await supabase
        .from('cotizaciones')
        .select('*')
        .in('id', (
          await supabase
            .from('respuestas_cotizacion')
            .select('cotizacion_id')
            .eq('estado', 'asignada')
            .eq('empresa_id', empresa.id)
        ).data?.map(r => r.cotizacion_id) || []);
      console.log('[ResponderCotizaciones] Cotizaciones directas (por empresa y estado asignada):', cotDirectas);
      // Traer todas las cotizaciones donde alguna respuesta esté asignada a esta empresa
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*, respuestas_cotizacion(*), cotizacion_detalle(*)');
      console.log('[ResponderCotizaciones] Cotizaciones (raw):', data);
      if (!error && data) {
        // Filtrar cotizaciones donde alguna respuesta tiene estado 'asignada' y empresa_id igual al logueado
        const asignadas = data.filter(cot =>
          (cot.respuestas_cotizacion || []).some(r => r.estado === 'asignada' && r.empresa_id === empresa.id)
        );
        console.log('[ResponderCotizaciones] Cotizaciones realmente asignadas a esta empresa:', asignadas);
        setCotizaciones(asignadas);
        const detallesObj = {};
        for (const cot of asignadas) {
          detallesObj[cot.id] = cot.cotizacion_detalle || [];
        }
        setDetalles(detallesObj);
      } else {
        console.error('[ResponderCotizaciones] Error al cargar cotizaciones:', error);
      }
      setLoading(false);
    };
    fetchCotizaciones();
  }, []);

  useEffect(() => {
    if (cotizaciones.length === 0) return;
    // Obtener IDs únicos de clientes
    const clienteIds = Array.from(new Set(cotizaciones.map(c => c.cliente_id)));
    if (clienteIds.length === 0) return;
    console.log('[ResponderCotizaciones] Cliente IDs para profiles:', clienteIds);
    supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', clienteIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('[ResponderCotizaciones] Error al cargar profiles:', error);
        } else {
          console.log('[ResponderCotizaciones] Profiles recibidos:', data);
        }
        const map = {};
        (data || []).forEach(u => { map[u.id] = u; });
        setClientesInfo(map);
      });
  }, [cotizaciones]);

  const calcularMonto = async (empresaId, productoId, alto, ancho) => {
    // Buscar precio personalizado
    const { data: precioPersonalizado } = await supabase
      .from('precios_actualizados')
      .select('valor_actualizado')
      .eq('id_empresa', empresaId)
      .eq('id_producto', productoId)
      .single();
    let precio = 0;
    if (precioPersonalizado) {
      precio = Number(precioPersonalizado.valor_actualizado);
    } else {
      // Tomar precio base del producto
      const { data: prod } = await supabase
        .from('productos')
        .select('precio')
        .eq('id_producto', productoId)
        .single();
      precio = prod ? Number(prod.precio) : 0;
    }
    return ((alto * ancho) / 10000) * precio;
  };

  const responderCotizacion = async (cotizacionId) => {
    setSuccess('');
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // Solo empresas
    const { data: empresa } = await supabase.from('empresas').select('id').eq('id', session.user.id).single();
    if (!empresa) {
      setError('Solo empresas pueden responder cotizaciones');
      return;
    }
    // Obtener detalles
    const { data: detallesCot } = await supabase
      .from('cotizacion_detalle')
      .select('*')
      .eq('cotizacion_id', cotizacionId);
    let montoTotal = 0;
    for (const det of detallesCot) {
      const monto = await calcularMonto(empresa.id, det.producto_id, det.alto, det.ancho);
      montoTotal += monto;
    }
    // Insertar respuesta
    const { error } = await supabase.from('respuestas_cotizacion').insert([
      {
        cotizacion_id: cotizacionId,
        empresa_id: empresa.id,
        monto: montoTotal
      }
    ]);
    if (error) setError('Error al responder cotización');
    else setSuccess('Respuesta enviada correctamente');
  };

  if (loading) return <div>Cargando cotizaciones asignadas...</div>;

  return (
    <div className="cotizaciones-container" style={{ display: 'flex', maxWidth: 1200,flexDirection: 'column', alignItems: 'center', width: '120%' }}>
      <div className="cotizaciones-header" style={{ width: '120%', maxWidth: 1200 }}>
        <span className="cotizaciones-title">Cotizaciones asignadas</span>
      </div>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        {cotizaciones.length === 0 ? (
          <div>No hay cotizaciones asignadas.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
            <colgroup>
              <col style={{ width: '10%' }} /> {/* Cotización */}
              <col style={{ width: '22%' }} /> {/* Cliente */}
              <col style={{ width: '22%' }} /> {/* Email */}
              <col style={{ width: '22%' }} /> {/* Fecha */}
              <col style={{ width: '12%' }} /> {/* Monto asignado */}
              <col style={{ width: '18%' }} /> {/* Acciones */}
            </colgroup>
            <thead>
              <tr>
                <th>Cotización</th>
                <th>Cliente</th>
                <th>Email</th>
                <th>Fecha</th>
                <th>Monto asignado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(cot => {
                const respuesta = (cot.respuestas_cotizacion || []).find(r => r.estado === 'asignada' && r.empresa_id === cot.respuestas_cotizacion.find(rr => rr.estado === 'asignada')?.empresa_id);
                const cliente = clientesInfo[cot.cliente_id];
                return (
                  <tr key={cot.id}>
                    <td>{cot.numero_cotizacion || cot.id}</td>
                    <td>{cliente && cliente.display_name ? cliente.display_name : '-'}</td>
                    <td>{cliente && cliente.email ? cliente.email : '-'}</td>
                    <td>{cot.fecha ? new Date(cot.fecha).toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{
                      respuesta && respuesta.monto !== undefined
                        ? respuesta.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
                        : '-'
                    }</td>
                    <td>
                      <button style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                        Ver cotización
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ResponderCotizaciones;
