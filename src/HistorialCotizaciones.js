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

  const [role, setRole] = useState('');

  // Estados para mensajes nuevos
  const [tieneNuevosMensajes, setTieneNuevosMensajes] = React.useState({});

  // Estados para usuario autenticado
  const [usuario, setUsuario] = useState(null);

  // useEffect para cargar rol y evitar fetchCotizaciones hasta tener el rol definido
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile?.role) setRole(profile.role);
      else setRole('cliente'); // fallback para evitar quedarse indefinido
      setUsuario(session?.user || null);
    })();
  }, []);

  const fetchCotizaciones = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No autenticado');
      let cotizacionesData = [], ventasArr = [], detallesObj = {}, respuestasObj = {}, empresaIds = new Set();
      if (role === 'empresa') {
        // Empresas: ver cotizaciones asignadas (ventas donde empresa_id = usuario.id)
        const { data: ventasDataRaw, error: ventasError } = await supabase
          .from('ventas')
          .select('*, cotizaciones(*, respuestas_cotizacion(*), cotizacion_detalle(*))')
          .eq('empresa_id', session.user.id);
        ventasArr = ventasDataRaw || [];
        cotizacionesData = ventasArr.map(v => v.cotizaciones).filter(Boolean);
        // Procesar detalles y respuestas
        for (const v of ventasArr) {
          if (v.cotizaciones) {
            detallesObj[v.cotizaciones.id] = v.cotizaciones.cotizacion_detalle || [];
            respuestasObj[v.cotizaciones.id] = v.cotizaciones.respuestas_cotizacion || [];
            (v.cotizaciones.respuestas_cotizacion || []).forEach(r => empresaIds.add(r.empresa_id));
          }
        }
      } else {
        // Clientes: igual que antes
        const { count } = await supabase
          .from('cotizaciones')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', session.user.id);
        setTotalCotizaciones(count || 0);
        const fromIdx = (pagina - 1) * cotizacionesPorPagina;
        const toIdx = fromIdx + cotizacionesPorPagina - 1;
        const { data: cotizacionesRaw, error: cotizacionesError } = await supabase
          .from('cotizaciones')
          .select('*, respuestas_cotizacion(*), cotizacion_detalle(*)')
          .eq('cliente_id', session.user.id)
          .order('fecha', { ascending: false })
          .range(fromIdx, toIdx);
        cotizacionesData = cotizacionesRaw || [];
        for (const cot of cotizacionesData) {
          detallesObj[cot.id] = cot.cotizacion_detalle || [];
          respuestasObj[cot.id] = cot.respuestas_cotizacion || [];
          (cot.respuestas_cotizacion || []).forEach(r => empresaIds.add(r.empresa_id));
        }
        // Obtener ventas del usuario (por sus cotizaciones)
        const cotIds = (cotizacionesData || []).map(cot => cot.id);
        if (cotIds.length > 0) {
          const { data: ventasData } = await supabase
            .from('ventas')
            .select('*')
            .in('cotizacion_id', cotIds);
          ventasArr = ventasData || [];
        }
      }
      // Obtener nombres de productos
      let productoIds = new Set();
      Object.values(detallesObj).flat().forEach(det => productoIds.add(det.producto_id));
      if (productoIds.size > 0) {
        // Obtener también los nombres de tinta para los detalles
        // 1. Traer detalles con JOIN a tintas
        const { data: detallesConTinta } = await supabase
          .from('cotizacion_detalle')
          .select('id, cotizacion_id, producto_id, alto, ancho, id_tinta, tintas(nombre)')
          .in('cotizacion_id', cotizacionesData.map(cot => cot.id));
        // 2. Construir nuevo detallesObj con nombre_tinta
        if (detallesConTinta) {
          const detallesPorCot = {};
          for (const det of detallesConTinta) {
            const cotId = det.cotizacion_id;
            if (!detallesPorCot[cotId]) detallesPorCot[cotId] = [];
            detallesPorCot[cotId].push({ ...det, nombre_tinta: det.tintas?.nombre || '-' });
          }
          detallesObj = detallesPorCot;
        }
        // Obtener nombres de productos
        const { data: productosData } = await supabase
          .from('productos')
          .select('id_producto, nombre_producto')
          .in('id_producto', Array.from(productoIds));
        const info = {};
        productosData?.forEach(p => { info[p.id_producto] = p.nombre_producto; });
        setProductosInfo(info);
      }
      setCotizaciones(cotizacionesData || []);
      setVentas(ventasArr);
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
    } catch (e) {
      setCotizaciones([]);
      setVentas([]);
    }
    setLoading(false);
  }, [pagina, role]);

  // Solo buscar cotizaciones cuando el rol está definido
  useEffect(() => {
    if (!role) return; // Esperar a tener el rol
    fetchCotizaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCotizaciones, recargarTrigger, role]);

  // Dado un producto y tipo de tinta, busca el precio en precios_actualizados o, si no existe, en productos según el tipo de tinta
  async function obtenerPrecioUnitario(id_empresa, id_producto, id_tinta) {
    // Busca el precio personalizado para ese producto y tinta
    const { data: preciosPersonalizados, error: errorPersonalizado } = await supabase
      .from('precios_actualizados')
      .select('valor_actualizado')
      .eq('id_empresa', id_empresa)
      .eq('id_producto', id_producto)
      .eq('id_tinta', id_tinta)
      .limit(1);
    if (preciosPersonalizados && preciosPersonalizados.length > 0) {
      return Number(preciosPersonalizados[0].valor_actualizado);
    }
    // Si no hay precio personalizado, buscar en productos según el tipo de tinta
    const tintaMap = {
      'SOLVENTADAS': 'precio_solvente',
      'ECO SOLVENTE': 'precio_ecosolvente',
      'UV': 'precio_uv',
      'LATEX': 'precio_latex',
      'RESINA': 'precio_resina',
    };
    // Obtener el nombre de tinta
    let tintaNombre = null;
    if (id_tinta) {
      const { data: tintaData, error: errorTinta } = await supabase.from('tintas').select('nombre').eq('id', id_tinta).single();
      if (tintaData && tintaData.nombre) {
        tintaNombre = tintaData.nombre.trim().toUpperCase();
      }
    }
    if (tintaNombre && tintaMap[tintaNombre]) {
      const { data: prod, error: errorProd } = await supabase.from('productos').select(tintaMap[tintaNombre]).eq('id_producto', id_producto).single();
      if (prod && prod[tintaMap[tintaNombre]] !== undefined) {
        return Number(prod[tintaMap[tintaNombre]]);
      }
    }
    // Si no hay precio específico, retornar 0
    return 0;
  }

  // Consulta de precios por empresa y producto para el modal
  const fetchPreciosPorEmpresa = useCallback(async (cotizacion, respuestasCot, detallesCot) => {
    // 1. Identificar todas las empresas y productos involucrados
    const empresaIds = respuestasCot.map(r => r.empresa_id);
    // 2. Para cada empresa y cada detalle, buscar precio personalizado según producto y tinta
    const preciosPorEmpresa = {};
    for (const resp of respuestasCot) {
      preciosPorEmpresa[resp.empresa_id] = {};
      for (const det of detallesCot) {
        let precio = null;
        if (det.id_tinta) {
          precio = await obtenerPrecioUnitario(resp.empresa_id, det.producto_id, det.id_tinta);
        }
        preciosPorEmpresa[resp.empresa_id][det.producto_id] = precio !== null ? precio : 0;
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
      if (errorAsignada || !respuestasAsignadas || respuestasAsignadas.length === 0) {
        alert('Error al asignar oferta');
        return;
      }
      const respuestaAsignada = respuestasAsignadas[0];
      // 2. Rechazar todas las demás
      const rechazarRes = await supabase.from('respuestas_cotizacion')
        .update({ estado: 'rechazada' })
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .neq('empresa_id', empresaId);
      // 3. Insertar registro en la tabla de ventas
      const monto_total = respuestaAsignada?.monto || 0;
      const comision = Math.round(monto_total * 0.02); // 5% de comisión ejemplo
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
      if (ventaRes.error) {
        alert('Error al registrar la venta: ' + ventaRes.error.message);
        return;
      }
      setModalOfertas({ abierto: false, cotizacion: null, precios: {} });
      setTimeout(() => {
        fetchCotizaciones();
      }, 400);
    } catch (e) {
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

  // --- Mensajes por cotización: buscar si hay mensajes nuevos por producto (optimizado) ---
  React.useEffect(() => {
    if (!usuario?.id) return;
    async function checkMensajes() {
      let nuevos = {};
      // Reunir todos los productos de todas las cotizaciones
      let allDetalles = [];
      for (const cot of cotizaciones) {
        const detallesCot = detalles[cot.id] || [];
        for (const det of detallesCot) {
          allDetalles.push({ cotId: cot.id, detId: det.id });
        }
      }
      if (allDetalles.length === 0) {
        setTieneNuevosMensajes({});
        return;
      }
      // Obtener todos los mensajes recientes de todos los productos en una sola consulta
      const cotIds = [...new Set(allDetalles.map(x => x.cotId))];
      const detIds = allDetalles.map(x => x.detId);
      const { data: mensajes } = await supabase
        .from('detalle_producto_cliente')
        .select('id, cotizacion_id, cotizacion_detalle_id, usuario_id, fecha')
        .in('cotizacion_id', cotIds)
        .in('cotizacion_detalle_id', detIds)
        .neq('usuario_id', usuario.id);
      // Procesar por producto
      for (const { cotId, detId } of allDetalles) {
        const key = `mensajes_leidos_${cotId}_${detId}_${usuario.id}`;
        let ultimaLectura = localStorage.getItem(key) || '1970-01-01';
        // Solo mensajes después de la última lectura y escritos por otro usuario
        const nuevosMensajes = (mensajes || []).filter(m =>
          m.cotizacion_id === cotId &&
          m.cotizacion_detalle_id === detId &&
          m.fecha > ultimaLectura
        );
        nuevos[detId] = nuevosMensajes.length > 0;
      }
      setTieneNuevosMensajes(nuevos);
    }
    if (cotizaciones.length > 0) checkMensajes();
  }, [cotizaciones, usuario, detalles]);

  // Nuevo: Determina si hay mensajes nuevos por cotización considerando todos sus productos
  function tieneMensajesNuevosEnCotizacion(cotId) {
    const detallesCot = detalles[cotId] || [];
    // Si algún producto tiene mensajes nuevos, retorna true
    return detallesCot.some(det => tieneNuevosMensajes[det.id]);
  }

  // Dado un producto y empresa, busca el precio actualizado si existe; si no, el precio base correcto
  async function obtenerPrecioUnitarioPublicar(id_empresa, id_producto, id_tinta) {
    // 1. Busca el precio actualizado para ese producto, empresa y tinta
    const { data: preciosPersonalizados } = await supabase
      .from('precios_actualizados')
      .select('valor_actualizado')
      .eq('id_empresa', id_empresa)
      .eq('id_producto', id_producto)
      .eq('id_tinta', id_tinta)
      .limit(1);
    if (preciosPersonalizados && preciosPersonalizados.length > 0 && preciosPersonalizados[0].valor_actualizado !== null) {
      return Number(preciosPersonalizados[0].valor_actualizado);
    }
    // 2. Si no hay precio actualizado, buscar el precio base correcto de productos según tipo de tinta
    let tintaNombre = null;
    if (id_tinta) {
      const { data: tintaData } = await supabase.from('tintas').select('nombre').eq('id', id_tinta).single();
      if (tintaData && tintaData.nombre) {
        tintaNombre = tintaData.nombre.trim().toUpperCase();
      }
    }
    const tintaMap = {
      'SOLVENTADAS': 'precio_solvente',
      'SOLVENTADA': 'precio_solvente',
      'ECO SOLVENTE': 'precio_ecosolvente',
      'ECO-SOLVENTADAS': 'precio_ecosolvente',
      'UV': 'precio_uv',
      'LATEX': 'precio_latex',
      'RESINA': 'precio_resina',
    };
    let campoPrecio = tintaNombre && tintaMap[tintaNombre] ? tintaMap[tintaNombre] : null;
    if (campoPrecio) {
      const { data: prod } = await supabase.from('productos').select(`${campoPrecio}, precio`).eq('id_producto', id_producto).single();
      if (prod && prod[campoPrecio] !== undefined && prod[campoPrecio] !== null && !isNaN(Number(prod[campoPrecio])) && Number(prod[campoPrecio]) > 0) {
        return Number(prod[campoPrecio]);
      }
      if (prod && prod.precio !== undefined && prod.precio !== null && !isNaN(Number(prod.precio)) && Number(prod.precio) > 0) {
        return Number(prod.precio);
      }
    } else {
      const { data: prodBase } = await supabase.from('productos').select('precio').eq('id_producto', id_producto).single();
      if (prodBase && prodBase.precio !== undefined && prodBase.precio !== null && !isNaN(Number(prodBase.precio)) && Number(prodBase.precio) > 0) {
        return Number(prodBase.precio);
      }
    }
    return 0;
  }

  // --- NUEVO: Hook para obtener precios unitarios para el modal de detalle ---
  const obtenerPreciosUnitariosDetalle = useCallback(async (empresa_id, detallesCot) => {
    const precios = [];
    for (const det of detallesCot) {
      const precio = await obtenerPrecioUnitarioPublicar(empresa_id, det.producto_id, det.id_tinta);
      precios.push(precio);
    }
    return precios;
  }, []);

  // --- En el render del modal, usa un estado para los precios unitarios ---
  const [preciosUnitariosModal, setPreciosUnitariosModal] = useState({});

  useEffect(() => {
    if (modalOfertas.abierto && modalOfertas.cotizacion && detalles[modalOfertas.cotizacion.id]) {
      const respuestasCot = respuestas[modalOfertas.cotizacion.id] || [];
      respuestasCot.forEach(async (resp) => {
        const detallesCot = detalles[modalOfertas.cotizacion.id] || [];
        const precios = await obtenerPreciosUnitariosDetalle(resp.empresa_id, detallesCot);
        setPreciosUnitariosModal(prev => ({ ...prev, [resp.empresa_id]: precios }));
      });
    }
  }, [modalOfertas.abierto, modalOfertas.cotizacion, detalles, respuestas]);

  // Lógica de publicación
  async function handlePublicar(cot) {
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
        .select('id, tipo_empresa, estado')
        .ilike('tipo_empresa', '%publicidad%');
      // 3. Filtrar solo empresas habilitadas
      const empresasHabilitadas = (empresasPublicidad || []).filter(e => e.estado === 'Habilitada para vender');
      if (!empresasHabilitadas.length) {
        alert('No hay empresas habilitadas para vender. No se realizará cotización automática.');
        setCotizaciones(prev => prev.map(c => c.id === cot.id ? { ...c, publicando: false } : c));
        return;
      }
      // 4. Buscar detalles
      const { data: detallesCot } = await supabase
        .from('cotizacion_detalle')
        .select('*')
        .eq('cotizacion_id', cot.id);
      // 5. Para cada empresa habilitada, calcular monto y crear oferta automática
      for (const empresa of empresasHabilitadas) {
        let montoTotal = 0;
        for (const det of detallesCot) {
          // Usar la función correcta para calcular el precio unitario
          const precioUnitario = await obtenerPrecioUnitarioPublicar(empresa.id, det.producto_id, det.id_tinta);
          montoTotal += ((Number(det.alto) * Number(det.ancho)) / 10000) * precioUnitario;
        }
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
  }

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
            <th>Mensajes</th>
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
                      Interactuar con la Empresa
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
                      onClick={() => handlePublicar(cot)}
                    >
                      {cot.publicando ? 'Publicando...' : 'Publicar'}
                    </button>
                  )}
                </td>
                <td>
                  {tieneMensajesNuevosEnCotizacion(cot.id)
                    ? <span style={{ color: '#e67e22', fontWeight: 600 }}>Nuevos Mensajes</span>
                    : 'Sin mensajes nuevos'}
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
                    <div><b>Monto:</b> {asignada.monto !== undefined && asignada.monto !== null ? asignada.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }) : '-'}</div>
                    <div><b>Estado:</b> {asignada.estado}</div>
                    <div style={{ marginTop: 16 }}>
                      <table style={{ width: '100%', marginTop: 8, fontSize: 14, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ textAlign: 'left', padding: 4 }}>Producto</th>
                            <th style={{ textAlign: 'left', padding: 4 }}>Tipo de tinta</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Precio unitario</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Ancho</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Largo</th>
                            <th style={{ textAlign: 'right', padding: 4 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detalles[modalOfertas.cotizacion.id] || []).map((det, i) => {
                            let precioUnit = null;
                            if (preciosUnitariosModal[asignada.empresa_id] && preciosUnitariosModal[asignada.empresa_id][i] !== undefined) {
                              precioUnit = preciosUnitariosModal[asignada.empresa_id][i];
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
                                <td style={{ padding: 4 }}>{det.nombre_tinta || det.tinta_nombre || '-'}</td>
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
                                        <th style={{ textAlign: 'left', padding: 4 }}>Tipo de tinta</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Precio unitario</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Ancho</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Largo</th>
                                        <th style={{ textAlign: 'right', padding: 4 }}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(detalles[modalOfertas.cotizacion.id] || []).map((det, i) => {
                                        let precioUnit = null;
                                        if (preciosUnitariosModal[oferta.empresa_id] && preciosUnitariosModal[oferta.empresa_id][i] !== undefined) {
                                          precioUnit = preciosUnitariosModal[oferta.empresa_id][i];
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
                                            <td style={{ padding: 4 }}>{det.nombre_tinta || det.tinta_nombre || '-'}</td>
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
