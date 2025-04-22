import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

function HistorialCotizaciones({ recargarTrigger, setView, setNegociacionActiva, handleIrANegociacion }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [detalles, setDetalles] = useState({});
  const [productosInfo, setProductosInfo] = useState({});
  const [respuestas, setRespuestas] = useState({});
  const [empresasInfo, setEmpresasInfo] = useState({});
  const [ventas, setVentas] = useState([]); // NUEVO: estado para ventas
  const [loading, setLoading] = useState(true);
  const [modalOfertas, setModalOfertas] = useState({ abierto: false, cotizacion: null, precios: {}, detalleAsignada: null, expandida: null });
  const [mostrarMasEmpresas, setMostrarMasEmpresas] = useState(false);
  const [paginaEmpresas, setPaginaEmpresas] = useState(1);
  const empresasPorPagina = 15;

  // Estados para paginación
  const [pagina, setPagina] = useState(1);
  const cotizacionesPorPagina = 10;
  const [totalCotizaciones, setTotalCotizaciones] = useState(0);

  const fetchCotizaciones = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No autenticado');
      // 1. Obtener total para paginación
      const { count } = await supabase
        .from('cotizaciones')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', session.user.id);
      setTotalCotizaciones(count || 0);
      // 2. Obtener cotizaciones paginadas + respuestas (ofertas) y detalles
      const fromIdx = (pagina - 1) * cotizacionesPorPagina;
      const toIdx = fromIdx + cotizacionesPorPagina - 1;
      const { data: cotizacionesData, error: cotizacionesError } = await supabase
        .from('cotizaciones')
        .select('*, respuestas_cotizacion(*), cotizacion_detalle(*)')
        .eq('cliente_id', session.user.id)
        .order('fecha', { ascending: false })
        .range(fromIdx, toIdx);
      if (cotizacionesError) throw cotizacionesError;
      setCotizaciones(cotizacionesData || []);
      // Procesar detalles y respuestas para mantener la estructura anterior
      const detallesObj = {};
      const respuestasObj = {};
      let empresaIds = new Set();
      for (const cot of cotizacionesData || []) {
        detallesObj[cot.id] = cot.cotizacion_detalle || [];
        respuestasObj[cot.id] = cot.respuestas_cotizacion || [];
        (cot.respuestas_cotizacion || []).forEach(r => empresaIds.add(r.empresa_id));
      }
      setDetalles(detallesObj);
      setRespuestas(respuestasObj);
      // Obtener nombres de empresas
      if (empresaIds.size > 0) {
        const { data: empresasData } = await supabase
          .from('empresas')
          .select('id, nombre')
          .in('id', Array.from(empresaIds));
        const empresasMap = {};
        empresasData?.forEach(e => { empresasMap[e.id] = e.nombre; });
        setEmpresasInfo(empresasMap);
      }
      // Obtener ventas del usuario (por sus cotizaciones)
      const cotIds = (cotizacionesData || []).map(cot => cot.id);
      let ventasArr = [];
      if (cotIds.length > 0) {
        const { data: ventasData } = await supabase
          .from('ventas')
          .select('*')
          .in('cotizacion_id', cotIds);
        ventasArr = ventasData || [];
      }
      setVentas(ventasArr);
      // Obtener nombres de productos (opcional, si quieres mostrar nombre en vez de id)
      let productoIds = new Set();
      Object.values(detallesObj).flat().forEach(det => productoIds.add(det.producto_id));
      if (productoIds.size > 0) {
        const { data: productosData } = await supabase
          .from('productos')
          .select('id_producto, nombre_producto')
          .in('id_producto', Array.from(productoIds));
        const info = {};
        productosData?.forEach(p => { info[p.id_producto] = p.nombre_producto; });
        setProductosInfo(info);
      }
    } catch (e) {
      // Manejar error
      setCotizaciones([]);
      setVentas([]);
    }
    setLoading(false);
  }, [pagina]);

  useEffect(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones, recargarTrigger]);

  // Consulta de precios por empresa y producto para el modal
  const fetchPreciosPorEmpresa = useCallback(async (cotizacion, respuestasCot, detallesCot) => {
    // 1. Identificar todas las empresas y productos involucrados
    const empresaIds = respuestasCot.map(r => r.empresa_id);
    const productoIds = detallesCot.map(d => d.producto_id);

    // 2. Traer todos los precios personalizados de una sola vez
    const { data: preciosPersonalizados } = await supabase
      .from('precios_actualizados')
      .select('id_empresa, id_producto, valor_actualizado')
      .in('id_empresa', empresaIds)
      .in('id_producto', productoIds);

    // 3. Traer todos los precios base de los productos
    const { data: productosBase } = await supabase
      .from('productos')
      .select('id_producto, precio')
      .in('id_producto', productoIds);

    // 4. Indexar los precios para acceso rápido
    const preciosPersonalizadosMap = {};
    for (const p of preciosPersonalizados || []) {
      preciosPersonalizadosMap[`${p.id_empresa}_${p.id_producto}`] = Number(p.valor_actualizado);
    }
    const preciosBaseMap = {};
    for (const p of productosBase || []) {
      preciosBaseMap[p.id_producto] = Number(p.precio);
    }

    // 5. Construir el resultado
    const preciosPorEmpresa = {};
    for (const resp of respuestasCot) {
      preciosPorEmpresa[resp.empresa_id] = {};
      for (const det of detallesCot) {
        const key = `${resp.empresa_id}_${det.producto_id}`;
        let precio = preciosPersonalizadosMap[key];
        if (precio === undefined) {
          precio = preciosBaseMap[det.producto_id] ?? 0;
        }
        preciosPorEmpresa[resp.empresa_id][det.producto_id] = precio;
      }
    }
    return preciosPorEmpresa;
  }, []);

  // Hook para cargar precios al abrir el modal
  useEffect(() => {
    const cargarPrecios = async () => {
      if (modalOfertas.abierto && modalOfertas.cotizacion) {
        const respuestasCot = respuestas[modalOfertas.cotizacion.id] || [];
        const detallesCot = detalles[modalOfertas.cotizacion.id] || [];
        const precios = await fetchPreciosPorEmpresa(modalOfertas.cotizacion, respuestasCot, detallesCot);
        setModalOfertas(prev => ({ ...prev, precios }));
      }
    };
    cargarPrecios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOfertas.abierto, modalOfertas.cotizacion]);

  // --- Acciones para aceptar/rechazar ofertas ---
  const handleAceptarOferta = async (empresaId) => {
    if (!modalOfertas.cotizacion) return;
    try {
      // 1. Asignar la seleccionada
      const { data: respuestasAsignadas, error: errorAsignada } = await supabase.from('respuestas_cotizacion')
        .update({ estado: 'asignada' })
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .eq('empresa_id', empresaId)
        .select('*');
      console.log('Resultado asignar:', respuestasAsignadas, errorAsignada);
      if (errorAsignada || !respuestasAsignadas || respuestasAsignadas.length === 0) {
        console.error('Error al asignar oferta:', errorAsignada, respuestasAsignadas);
        alert('Error al asignar oferta');
        return;
      }
      const respuestaAsignada = respuestasAsignadas[0];
      // 2. Rechazar todas las demás
      const rechazarRes = await supabase.from('respuestas_cotizacion')
        .update({ estado: 'rechazada' })
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .neq('empresa_id', empresaId);
      console.log('Resultado rechazar:', rechazarRes);
      // 3. Insertar registro en la tabla de ventas
      const monto_total = respuestaAsignada?.monto || 0;
      const comision = Math.round(monto_total * 0.05); // 5% de comisión ejemplo
      const monto_empresa = monto_total - comision;
      const ventaRes = await supabase.from('ventas').insert([
        {
          cotizacion_id: modalOfertas.cotizacion.id,
          empresa_id: empresaId,
          monto_total,
          monto_empresa,
          monto_comision: comision,
          estado: 'pendiente',
          respuesta_id: respuestaAsignada?.id || null
        }
      ]);
      console.log('Resultado venta:', ventaRes);
      if (ventaRes.error) {
        console.error('Error al registrar la venta:', ventaRes.error);
        alert('Error al registrar la venta: ' + ventaRes.error.message);
        return;
      }
      setModalOfertas({ abierto: false, cotizacion: null, precios: {} });
      setTimeout(() => {
        fetchCotizaciones();
      }, 400);
    } catch (e) {
      console.error('Error inesperado en handleAceptarOferta:', e);
      alert('Error inesperado al aceptar la oferta');
    }
  };
  const handleRechazarOferta = async (empresaId) => {
    if (!modalOfertas.cotizacion) return;
    // Actualiza el estado a 'rechazada' en vez de eliminar
    await supabase.from('respuestas_cotizacion')
      .update({ estado: 'rechazada' })
      .eq('cotizacion_id', modalOfertas.cotizacion.id)
      .eq('empresa_id', empresaId);
    // Actualización local: elimina del estado solo si quieres ocultar en UI
    setModalOfertas(prev => {
      if (!prev.cotizacion) return { abierto: false, cotizacion: null, precios: {} };
      return {
        ...prev,
        expandida: prev.expandida === empresaId ? null : prev.expandida
      };
    });
    setRespuestas(prev => {
      const id = modalOfertas.cotizacion.id;
      const oldArr = prev[id] || [];
      // Opcional: puedes filtrar aquí si no quieres mostrar rechazadas
      return {
        ...prev,
        [id]: oldArr.map(r => r.empresa_id === empresaId ? { ...r, estado: 'rechazada' } : r)
      };
    });
  };

  // --- Utilidad para obtener precios por empresa antes de abrir modal ---
  const abrirDetalleAsignada = async (cot, ofertaAsignada) => {
    // Si ya tenemos precios, abrir directo
    if (modalOfertas.precios && modalOfertas.precios[ofertaAsignada.empresa_id]) {
      setModalOfertas({ abierto: true, cotizacion: cot, precios: modalOfertas.precios, detalleAsignada: ofertaAsignada });
      return;
    }
    // Si no, cargar precios antes de abrir el modal
    const respuestasCot = respuestas[cot.id] || [];
    const detallesCot = detalles[cot.id] || [];
    const precios = await fetchPreciosPorEmpresa(cot, respuestasCot, detallesCot);
    setModalOfertas({ abierto: true, cotizacion: cot, precios, detalleAsignada: ofertaAsignada });
  };

  if (loading) return <div>Cargando historial...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 400, color: '#19223a', marginBottom: 16 }}>Historial de Cotizaciones</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th>Cotización</th>
            <th>Asignada</th>
            <th>Venta</th>
            <th>Monto asignado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map(cot => {
            const respuestasCot = respuestas[cot.id] || [];
            const ofertaAsignada = respuestasCot.find(r => r.estado === 'asignada');
            // Debe mostrar "COT. Rechazadas" si NO hay respuestas para esa cotización (todas eliminadas)
            const todasRechazadas = respuestasCot.length === 0 || (respuestasCot.length > 0 && respuestasCot.every(r => r.estado === 'rechazada'));
            const venta = ventas.find(v => v.cotizacion_id === cot.id);
            // Buscar monto de la empresa asignada
            let montoAsignado = '-';
            if (ofertaAsignada) {
              montoAsignado = ofertaAsignada.monto !== undefined && ofertaAsignada.monto !== null
                ? ofertaAsignada.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
                : '-';
            }
            // NUEVO: Mostrar "Sin publicar" si la cotización no está publicada
            let estadoAsignada = null;
            if (cot.estado === 'pendiente' || cot.estado === 'borrador' || cot.estado === 'pendiente a publicar') {
              estadoAsignada = <span style={{ color: '#888' }}>Sin publicar</span>;
            } else if (ofertaAsignada) {
              estadoAsignada = <span style={{ color: '#43c463', fontWeight: 600 }}>{empresasInfo[ofertaAsignada.empresa_id] || ofertaAsignada.empresa_id}</span>;
            } else if (todasRechazadas) {
              estadoAsignada = <span style={{ color: '#e74c3c', fontWeight: 600 }}>COT. Rechazadas</span>;
            } else {
              estadoAsignada = <span style={{ color: '#888' }}>Sin asignar</span>;
            }
            return (
              <tr key={cot.id}>
                <td>{cot.numero_cotizacion || cot.id}</td>
                <td>{estadoAsignada}</td>
                <td>
                  {venta ? (
                    <span style={{ color: venta.estado === 'pendiente' ? '#1976d2' : '#43c463', fontWeight: 600 }}>
                      {venta.estado}
                    </span>
                  ) : (
                    <span style={{ color: '#888' }}>-</span>
                  )}
                </td>
                <td>
                  {montoAsignado}
                </td>
                <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {venta && venta.estado === 'pendiente' ? (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => handleIrANegociacion(venta, cot, empresasInfo[ofertaAsignada?.empresa_id] ? { id: ofertaAsignada?.empresa_id, nombre: empresasInfo[ofertaAsignada.empresa_id] } : null)}
                    >
                      Ir a Portal de Negociaciones
                    </button>
                  ) : ofertaAsignada ? (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => abrirDetalleAsignada(cot, ofertaAsignada)}
                    >
                      Ver cotización
                    </button>
                  ) : cot.estado === 'publicado' && (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => setModalOfertas({ abierto: true, cotizacion: cot, precios: {} })}
                    >
                      Ver cotizaciones de empresas
                    </button>
                  )}
                  {cot.estado === 'pendiente a publicar' && (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      disabled={cot.publicando}
                      onClick={async () => {
                        if (cot.publicando) return;
                        setCotizaciones(prev => prev.map(c => c.id === cot.id ? { ...c, publicando: true } : c));
                        try {
                          // 1. Publicar la cotización
                          await supabase.from('cotizaciones')
                            .update({ estado: 'publicado' })
                            .eq('id', cot.id);
                          // 2. Buscar empresas de publicidad
                          const { data: empresasPublicidad } = await supabase
                            .from('empresas')
                            .select('id, tipo_empresa')
                            .ilike('tipo_empresa', '%publicidad%');
                          // 3. Buscar detalles
                          const { data: detallesCot } = await supabase
                            .from('cotizacion_detalle')
                            .select('*')
                            .eq('cotizacion_id', cot.id);
                          // 4. Para cada empresa, calcular monto y crear oferta
                          for (const empresa of empresasPublicidad || []) {
                            let montoTotal = 0;
                            for (const det of detallesCot || []) {
                              // Busca precio personalizado
                              let precio = 0;
                              const { data: preciosPersonalizados } = await supabase
                                .from('precios_actualizados')
                                .select('valor_actualizado')
                                .eq('id_empresa', empresa.id)
                                .eq('id_producto', det.producto_id)
                                .limit(1);
                              if (preciosPersonalizados && preciosPersonalizados.length > 0) {
                                precio = Number(preciosPersonalizados[0].valor_actualizado);
                              } else {
                                // Precio base
                                const { data: prodBase } = await supabase
                                  .from('productos')
                                  .select('precio')
                                  .eq('id_producto', det.producto_id)
                                  .single();
                                precio = prodBase ? Number(prodBase.precio) : 0;
                              }
                              montoTotal += ((Number(det.alto) * Number(det.ancho)) / 10000) * precio;
                            }
                            // Insertar oferta automática
                            await supabase.from('respuestas_cotizacion').insert([
                              {
                                cotizacion_id: cot.id,
                                empresa_id: empresa.id,
                                monto: Math.round(montoTotal),
                                fecha: new Date().toISOString(),
                                estado: 'pendiente'
                              }
                            ]);
                          }
                          fetchCotizaciones();
                        } finally {
                          setTimeout(() => setCotizaciones(prev => prev.map(c => c.id === cot.id ? { ...c, publicando: false } : c)), 4000);
                        }
                      }}
                    >
                      {cot.publicando ? 'Publicando...' : 'Publicar'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Paginación de cotizaciones */}
      {totalCotizaciones > cotizacionesPorPagina && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '16px 0' }}>
          <button
            style={{ background: pagina === 1 ? '#eee' : '#1976d2', color: pagina === 1 ? '#888' : '#fff', border: 'none', borderRadius: 5, padding: '7px 18px', fontWeight: 600, fontSize: 15, cursor: pagina === 1 ? 'default' : 'pointer' }}
            onClick={() => pagina > 1 && setPagina(pagina - 1)}
            disabled={pagina === 1}
          >Anterior</button>
          <span style={{ alignSelf: 'center', fontWeight: 600, color: '#222', fontSize: 15 }}>
            Página {pagina} de {Math.ceil(totalCotizaciones / cotizacionesPorPagina)}
          </span>
          <button
            style={{ background: pagina === Math.ceil(totalCotizaciones / cotizacionesPorPagina) ? '#eee' : '#1976d2', color: pagina === Math.ceil(totalCotizaciones / cotizacionesPorPagina) ? '#888' : '#fff', border: 'none', borderRadius: 5, padding: '7px 18px', fontWeight: 600, fontSize: 15, cursor: pagina === Math.ceil(totalCotizaciones / cotizacionesPorPagina) ? 'default' : 'pointer' }}
            onClick={() => pagina < Math.ceil(totalCotizaciones / cotizacionesPorPagina) && setPagina(pagina + 1)}
            disabled={pagina === Math.ceil(totalCotizaciones / cotizacionesPorPagina)}
          >Siguiente</button>
        </div>
      )}
      {/* Modal de Ofertas de Empresas */}
      {modalOfertas.abierto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.13)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', paddingTop: 40
        }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, minWidth: 300, minHeight: 120, maxWidth: 700, width: '90%', boxShadow: '0 2px 12px #0002', position: 'relative' }}>
            <button onClick={() => setModalOfertas({ abierto: false, cotizacion: null, precios: {} })} style={{ position: 'absolute', top: 12, right: 18, fontSize: 22, border: 'none', background: 'none', cursor: 'pointer', color: '#888' }} title="Cerrar">×</button>
            <h3 style={{ margin: '0 0 18px 0' }}>
              Detalle de cotización asignada
            </h3>
            {(() => {
              // Buscar la empresa asignada
              const respuestasCot = respuestas[modalOfertas.cotizacion.id] || [];
              const asignada = respuestasCot.find(r => r.estado === 'asignada');
              const todasRechazadas = respuestasCot.length > 0 && respuestasCot.every(r => r.estado === 'rechazada');
              if (asignada) {
                return (
                  <div style={{ minWidth: 220 }}>
                    <div><b>Empresa:</b> {empresasInfo[asignada.empresa_id] || asignada.empresa_id}</div>
                    <div><b>Monto:</b> {asignada.monto !== undefined && asignada.monto !== null
                      ? asignada.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
                      : '-'}</div>
                    <div><b>Estado:</b> {asignada.estado}</div>
                    <div style={{ marginTop: 16 }}>
                      <table style={{ width: '100%', marginTop: 8, fontSize: 14, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ textAlign: 'left', padding: 4 }}>Producto</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Precio unitario</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Ancho</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Largo</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detalles[modalOfertas.cotizacion.id] || []).map((det, i) => {
                            let precioUnit = null;
                            if (modalOfertas.precios && modalOfertas.precios[asignada.empresa_id] && modalOfertas.precios[asignada.empresa_id][det.producto_id] !== undefined) {
                              precioUnit = modalOfertas.precios[asignada.empresa_id][det.producto_id];
                            }
                            let ancho = '-';
                            let largo = '-';
                            if (det.ancho !== undefined && det.ancho !== null && !isNaN(Number(det.ancho))) {
                              ancho = Number(det.ancho);
                            }
                            if (det.largo !== undefined && det.largo !== null && !isNaN(Number(det.largo))) {
                              largo = Number(det.largo);
                            } else if (det.alto !== undefined && det.alto !== null && !isNaN(Number(det.alto))) {
                              largo = Number(det.alto);
                            }
                            let total = '-';
                            if (precioUnit !== null && typeof ancho === 'number' && typeof largo === 'number' && ancho > 0 && largo > 0) {
                              total = ((ancho * largo) / 10000 * precioUnit);
                              total = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
                            }
                            return (
                              <tr key={i}>
                                <td style={{ padding: 4 }}>{productosInfo[det.producto_id] || det.producto_id}</td>
                                <td style={{ padding: 4, textAlign: 'right' }}>{precioUnit !== null ? precioUnit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }) : '-'}</td>
                                <td style={{ padding: 4, textAlign: 'right' }}>{ancho !== '-' ? ancho : '-'}</td>
                                <td style={{ padding: 4, textAlign: 'right' }}>{largo !== '-' ? largo : '-'}</td>
                                <td style={{ padding: 4, textAlign: 'right' }}>{total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }
              if (todasRechazadas) {
                return (
                  <div style={{ minWidth: 220, textAlign: 'center', margin: '24px 0', color: '#e74c3c', fontWeight: 600, fontSize: 18 }}>
                    Todas las cotizaciones fueron rechazadas<br/>
                    <span style={{ fontSize: 16, color: '#b71c1c' }}>Estado: Rechazado</span>
                  </div>
                );
              }
              if (!respuestasCot || respuestasCot.length === 0) {
                return (
                  <div style={{ minWidth: 220, textAlign: 'center', margin: '24px 0', color: '#888', fontWeight: 600, fontSize: 16 }}>
                    No hay cotizaciones disponibles para esta solicitud o fueron todas rechazadas.
                  </div>
                );
              }
              // Si no hay asignada, mostrar tabla de empresas como antes
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>Empresa</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Valor Total</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(respuestas[modalOfertas.cotizacion.id] || []).map((oferta, idx) => {
                      const rechazada = oferta.estado === 'rechazada';
                      return (
                        <React.Fragment key={oferta.empresa_id}>
                          <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 8, cursor: rechazada ? 'not-allowed' : 'pointer', fontWeight: 600, textDecoration: rechazada ? 'line-through' : 'none', color: rechazada ? '#888' : undefined }} onClick={() => !rechazada && setModalOfertas(prev => ({ ...prev, expandida: prev.expandida === oferta.empresa_id ? null : oferta.empresa_id }))}>
                              {empresasInfo[oferta.empresa_id] || oferta.empresa_id}
                            </td>
                            <td style={{ padding: 8, textAlign: 'right', textDecoration: rechazada ? 'line-through' : 'none', color: rechazada ? '#888' : undefined }}>
                              {oferta.monto !== undefined && oferta.monto !== null ? oferta.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }) : '-'}
                            </td>
                            <td style={{ padding: 8, textAlign: 'center' }}>
                              {rechazada ? (
                                <span style={{ color: '#e74c3c', fontWeight: 600 }}>Cotización rechazada</span>
                              ) : (
                                <>
                                  <button style={{ background: '#43c463', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginRight: 8 }} onClick={() => handleAceptarOferta(oferta.empresa_id)}>Aceptar</button>
                                  <button style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }} onClick={() => handleRechazarOferta(oferta.empresa_id)}>Rechazar</button>
                                  <button style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 14px', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginLeft: 8 }} onClick={() => setModalOfertas(prev => ({ ...prev, expandida: prev.expandida === oferta.empresa_id ? null : oferta.empresa_id }))}>
                                    {modalOfertas.expandida === oferta.empresa_id ? 'Ocultar' : 'Ver Detalle'}
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                          {modalOfertas.expandida === oferta.empresa_id && !rechazada && (
                            <tr>
                              <td colSpan={3} style={{ padding: 0, background: '#f9f9fa' }}>
                                <div style={{ padding: 14 }}>
                                  <table style={{ width: '100%', marginTop: 8, fontSize: 14, borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#f5f5f5' }}>
                                        <th style={{ textAlign: 'left', padding: 4 }}>Producto</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Precio unitario</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Ancho</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Largo</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(detalles[modalOfertas.cotizacion.id] || []).map((det, i) => {
                                        let precioUnit = null;
                                        if (modalOfertas.precios && modalOfertas.precios[oferta.empresa_id] && modalOfertas.precios[oferta.empresa_id][det.producto_id] !== undefined) {
                                          precioUnit = modalOfertas.precios[oferta.empresa_id][det.producto_id];
                                        }
                                        let ancho = '-';
                                        let largo = '-';
                                        if (det.ancho !== undefined && det.ancho !== null && !isNaN(Number(det.ancho))) {
                                          ancho = Number(det.ancho);
                                        }
                                        if (det.largo !== undefined && det.largo !== null && !isNaN(Number(det.largo))) {
                                          largo = Number(det.largo);
                                        } else if (det.alto !== undefined && det.alto !== null && !isNaN(Number(det.alto))) {
                                          largo = Number(det.alto);
                                        }
                                        let total = '-';
                                        if (precioUnit !== null && typeof ancho === 'number' && typeof largo === 'number' && ancho > 0 && largo > 0) {
                                          total = ((ancho * largo) / 10000 * precioUnit);
                                          total = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
                                        }
                                        return (
                                          <tr key={i}>
                                            <td style={{ padding: 4 }}>{productosInfo[det.producto_id] || det.producto_id}</td>
                                            <td style={{ padding: 4, textAlign: 'right' }}>{precioUnit !== null ? precioUnit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }) : '-'}</td>
                                            <td style={{ padding: 4, textAlign: 'right' }}>{ancho !== '-' ? ancho : '-'}</td>
                                            <td style={{ padding: 4, textAlign: 'right' }}>{largo !== '-' ? largo : '-'}</td>
                                            <td style={{ padding: 4, textAlign: 'right' }}>{total}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistorialCotizaciones;
