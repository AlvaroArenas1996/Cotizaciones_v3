import React, { useEffect, useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { supabase } from './supabaseClient';

function HistorialCotizaciones({ recargarTrigger, setView, setNegociacionActiva, handleIrANegociacion }) {
  const { enqueueSnackbar } = useSnackbar();
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
        // Empresas: ver cotizaciones donde su oferta fue aceptada (ventas donde empresa_id = usuario.id)
        // Primero obtenemos las ventas de la empresa
        const { data: ventasDataRaw, error: ventasError } = await supabase
          .from('ventas')
          .select(`
            *,
            cotizaciones (
              *,
              cliente:profiles!cotizaciones_cliente_id_fkey(id, display_name, email),
              cotizacion_detalle(*, producto:productos(id_producto, nombre_producto)),
              respuestas_cotizacion!cotizacion_id(*)
            )
          `)
          .eq('empresa_id', session.user.id);
        
        console.log('Ventas encontradas para la empresa:', ventasDataRaw);
        
        // Si no hay ventas, intentamos obtener las respuestas de cotización directamente
        if ((!ventasDataRaw || ventasDataRaw.length === 0) && !ventasError) {
          console.log('No se encontraron ventas, buscando respuestas de cotización...');
          const { data: respuestasData, error: respuestasError } = await supabase
            .from('respuestas_cotizacion')
            .select(`
              *,
              cotizaciones!inner(
                *,
                cliente:profiles!cotizaciones_cliente_id_fkey(id, display_name, email),
                cotizacion_detalle(*, producto:productos(id_producto, nombre_producto))
              )
            `)
            .eq('empresa_id', session.user.id);
            
          if (respuestasError) {
            console.error('Error al cargar respuestas de cotización:', respuestasError);
            throw respuestasError;
          }
          
          if (respuestasData && respuestasData.length > 0) {
            console.log('Respuestas de cotización encontradas:', respuestasData);
            
            // Procesar las respuestas
            respuestasData.forEach(respuesta => {
              if (respuesta.cotizaciones) {
                const cotizacion = respuesta.cotizaciones;
                const cotizacionId = cotizacion.id;
                
                // Agregar a cotizacionesData si no está ya incluida
                if (!cotizacionesData.some(c => c.id === cotizacionId)) {
                  cotizacionesData.push({
                    ...cotizacion,
                    // Asegurarse de que los campos requeridos estén presentes
                    cliente: cotizacion.cliente || {},
                    cotizacion_detalle: Array.isArray(cotizacion.cotizacion_detalle) 
                      ? cotizacion.cotizacion_detalle 
                      : []
                  });
                }
                
                // Procesar detalles
                if (cotizacion.cotizacion_detalle) {
                  detallesObj[cotizacionId] = Array.isArray(cotizacion.cotizacion_detalle) 
                    ? cotizacion.cotizacion_detalle 
                    : [];
                }
                
                // Procesar respuestas
                if (!respuestasObj[cotizacionId]) {
                  respuestasObj[cotizacionId] = [];
                }
                
                // Asegurarse de que la respuesta tenga los campos requeridos
                const respuestaProcesada = {
                  ...respuesta,
                  empresa_id: respuesta.empresa_id || session.user.id,
                  estado: respuesta.estado || 'pendiente',
                  monto: respuesta.monto || 0
                };
                
                respuestasObj[cotizacionId].push(respuestaProcesada);
                
                // Agregar ID de empresa
                if (respuesta.empresa_id) {
                  empresaIds.add(respuesta.empresa_id);
                }
              }
            });
            
            console.log('Datos procesados:', {
              cotizaciones: cotizacionesData.length,
              detalles: Object.keys(detallesObj).length,
              respuestas: Object.keys(respuestasObj).length,
              empresas: empresaIds.size,
              cotizacionesData,
              detallesObj,
              respuestasObj
            });
          }
          
          // Asignar los datos procesados a los arrays principales
          ventasArr = []; // No hay ventas, solo respuestas
        } else if (ventasError) {
          console.error('Error al cargar ventas:', ventasError);
          throw ventasError;
        } else {
          // Procesar ventas si las hay
          ventasArr = Array.isArray(ventasDataRaw) ? ventasDataRaw : [];
          cotizacionesData = ventasArr
            .map(v => v.cotizaciones)
            .filter(Boolean)
            .map(cot => ({
              ...cot,
              cotizacion_detalle: Array.isArray(cot.cotizacion_detalle) 
                ? cot.cotizacion_detalle 
                : []
            }));
          
          // Procesar detalles y respuestas de ventas
          for (const v of ventasArr) {
            if (v.cotizaciones) {
              const cotizacionId = v.cotizaciones.id;
              detallesObj[cotizacionId] = Array.isArray(v.cotizaciones.cotizacion_detalle) 
                ? v.cotizaciones.cotizacion_detalle 
                : [];
                
              respuestasObj[cotizacionId] = Array.isArray(v.cotizaciones.respuestas_cotizacion)
                ? v.cotizaciones.respuestas_cotizacion
                : [];
              
              if (v.cotizaciones.cliente) {
                cotizacionesData = cotizacionesData.map(cot => 
                  cot.id === cotizacionId 
                    ? { ...cot, cliente: v.cotizaciones.cliente }
                    : cot
                );
              }
              
              const respuestas = Array.isArray(v.cotizaciones.respuestas_cotizacion) 
                ? v.cotizaciones.respuestas_cotizacion 
                : [];
                
              respuestas.forEach(r => {
                if (r.empresa_id) empresaIds.add(r.empresa_id);
              });
            }
          }
        }
        
        console.log('Cotizaciones cargadas para empresa:', {
          ventas: ventasArr.length,
          cotizaciones: cotizacionesData.length,
          detalles: Object.keys(detallesObj).length,
          respuestas: Object.keys(respuestasObj).length,
          empresas: empresaIds.size
        });
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
      
      // Asegurarse de que los datos sean arrays
      const cotizacionesFinal = Array.isArray(cotizacionesData) ? cotizacionesData : [];
      const ventasFinal = Array.isArray(ventasArr) ? ventasArr : [];
      
      setCotizaciones(cotizacionesFinal);
      setVentas(ventasFinal);
      setDetalles(detallesObj || {});
      setRespuestas(respuestasObj || {});
      // Obtener nombres de perfiles de empresa
      if (empresaIds.size > 0) {
          const { data: perfilesData, error: perfilesError } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', Array.from(empresaIds));
        
        if (!perfilesError && perfilesData) {
          const empresasMap = {};
          perfilesData.forEach(e => { 
            // Usar display_name si existe, si no, usar la parte del email antes del @, si no, usar parte del ID
            const nombre = e.display_name || (e.email ? e.email.split('@')[0] : `Empresa ${e.id.substring(0, 6)}`);
            empresasMap[e.id] = nombre; 
          });
          setEmpresasInfo(empresasMap);
        }
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
    if (!modalOfertas.cotizacion) {
      alert('No se encontró la cotización');
      return;
    }
    
    try {
      // 1. Verificar que la empresa existe y es de tipo 'empresa'
      
      // Primero verificar en la tabla profiles
              const { data: empresa, error: errorEmpresa } = await supabase
                .from('profiles')
                .select('id, role, email, display_name')
                .eq('id', empresaId)
                .single();
      
      if (errorEmpresa || !empresa) {
        console.error('Error al verificar la empresa en profiles:', errorEmpresa);
        throw new Error('La empresa no existe en el sistema');
      }

      // Verificar que el perfil sea de tipo 'empresa'
      if (empresa.role !== 'empresa') {
        throw new Error('El perfil seleccionado no es una empresa válida');
      }

      // 1. Usar la función RPC para obtener o crear la empresa
      const { data: empresaData, error: rpcError } = await supabase
        .rpc('get_or_create_empresa', {
          p_profile_id: empresaId,
          p_nombre: empresa.display_name || 'Nueva Empresa',
          p_rut: '',
          p_direccion: '',
          p_tipo_empresa: 'publicidad'
        });

      if (rpcError) {
        console.error('Error en get_or_create_empresa:', rpcError);
        throw new Error(`No se pudo verificar/crear la empresa: ${rpcError.message}`);
      }

      // 2. Asignar la oferta seleccionada
      const { data: respuestasAsignadas, error: errorAsignada } = await supabase
        .from('respuestas_cotizacion')
        .update({ 
          estado: 'asignada'
        })
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .eq('empresa_id', empresaId)
        .select('*');
      
      if (errorAsignada || !respuestasAsignadas || respuestasAsignadas.length === 0) {
        console.error('Error al asignar oferta:', errorAsignada);
        throw new Error('No se pudo asignar la oferta. Por favor, inténtalo de nuevo.');
      }
      
      const respuestaAsignada = respuestasAsignadas[0];
      
      // 3. Rechazar las demás ofertas
      const { error: errorRechazarOtras } = await supabase
        .from('respuestas_cotizacion')
        .update({ 
          estado: 'rechazada'
        })
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .neq('empresa_id', empresaId);
      
      if (errorRechazarOtras) {
        console.error('Error al rechazar otras ofertas:', errorRechazarOtras);
        // No detenemos el flujo por este error, solo lo registramos
      }
      
      // 4. Insertar o actualizar el registro de venta
      const { data: ventaExistente, error: errorBuscarVenta } = await supabase
        .from('ventas')
        .select('*')
        .eq('cotizacion_id', modalOfertas.cotizacion.id)
        .maybeSingle();
      
      const ventaData = {
        cotizacion_id: modalOfertas.cotizacion.id,
        empresa_id: empresaId,
        respuesta_id: respuestaAsignada.id,
        monto_total: respuestaAsignada.monto,
        monto_comision: respuestaAsignada.monto * 0.02, // 2% de comisión
        monto_empresa: respuestaAsignada.monto * 0.98, // 98% para la empresa
        estado: 'pendiente'
        // Nota: Se eliminó created_at ya que no existe en la tabla
      };

      let venta;
      if (ventaExistente) {
        // Actualizar venta existente
        const { data: ventaActualizada, error: errorActualizar } = await supabase
          .from('ventas')
          .update(ventaData)
          .eq('id', ventaExistente.id)
          .select()
          .single();
          
        if (errorActualizar) throw errorActualizar;
        venta = ventaActualizada;
      } else {
        // Crear nueva venta
        const { data: nuevaVenta, error: errorNuevaVenta } = await supabase
          .from('ventas')
          .insert([ventaData])
          .select()
          .single();
          
        if (errorNuevaVenta) throw errorNuevaVenta;
        venta = nuevaVenta;
      }
      
      console.log('Venta creada/actualizada:', venta);
      
      // 5. Actualizar el estado de la cotización
      const { error: errorActualizarEstado } = await supabase
        .from('cotizaciones')
        .update({ 
          estado: 'asignada'
        })
        .eq('id', modalOfertas.cotizacion.id);
      
      if (errorActualizarEstado) {
        console.error('Error al actualizar estado de cotización:', errorActualizarEstado);
        // Continuamos a pesar del error
      }
      
      // Actualizar el estado local para reflejar los cambios
      setCotizaciones(prevCotizaciones => 
        prevCotizaciones.map(cotizacion => 
          cotizacion.id === modalOfertas.cotizacion.id 
            ? { ...cotizacion, estado: 'asignada' } 
            : cotizacion
        )
      );
      
      // Actualizar respuestas locales
      setRespuestas(prevRespuestas => ({
        ...prevRespuestas,
        [modalOfertas.cotizacion.id]: (
          prevRespuestas[modalOfertas.cotizacion.id] || []
        ).map(respuesta => ({
          ...respuesta,
          estado: respuesta.empresa_id === empresaId ? 'asignada' : 'rechazada'
        }))
      }));
      
      // Actualizar el estado de ventas local
      setVentas(prevVentas => [
        ...prevVentas.filter(v => v.cotizacion_id !== modalOfertas.cotizacion.id),
        {
          ...ventaData,
          id: venta?.id || 'temp-' + Date.now(), // Usar ID temporal si no existe
          empresa: empresa, // Asegurarse de incluir la información de la empresa
          respuesta: respuestaAsignada // Incluir la respuesta completa
        }
      ]);
      
      // Cerrar el modal después de todo
      setModalOfertas({ abierto: false, cotizacion: null, precios: {}, detalleAsignada: null, expandida: null });
      
      // Mostrar mensaje de éxito
      enqueueSnackbar('¡Oferta aceptada exitosamente!', { variant: 'success' });
      
      // Recargar los datos para asegurar consistencia
      fetchCotizaciones();
    } catch (error) {
      console.error('Error en handleAceptarOferta:', error);
      enqueueSnackbar(`Error al aceptar la oferta: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
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
      // 2. Obtener todas las empresas (con role = 'empresa')
      console.log('Buscando empresas...');
      const { data: perfilesEmpresas, error: errorEmpresas } = await supabase
        .from('profiles')
        .select('id, estado_empresa, display_name, updated_at')
        .eq('role', 'empresa');
      
      if (errorEmpresas) {
        console.error('Error al buscar empresas:', errorEmpresas);
        throw errorEmpresas;
      }
      
      console.log('Todas las empresas encontradas:', perfilesEmpresas);
      
      // 3. Filtrar empresas habilitadas
      const empresasHabilitadas = (perfilesEmpresas || []).filter(e => {
        // Verificar estado (si no tiene estado_empresa, asumir que está activa)
        const estaActiva = (e.estado_empresa || 'Activo') === 'Activo';
        return estaActiva;
      });
      
      console.log('Empresas habilitadas encontradas:', empresasHabilitadas);
      
      // 4. Verificar si hay empresas habilitadas
      if (!empresasHabilitadas.length) {
        console.log('No hay empresas habilitadas para cotizar');
        alert('No hay empresas habilitadas para vender. No se realizará cotización automática.');
        setCotizaciones(prev => prev.map(c => c.id === cot.id ? { ...c, publicando: false } : c));
        return;
      }
      
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
        let puedeCotizar = true;
        for (const det of detallesCot) {
          // Buscar precio personalizado y habilitado para ese producto/tinta
          const { data: precioPersonalizado, error: logError } = await supabase
            .from('precios_actualizados')
            .select('valor_actualizado, habilitado')
            .eq('id_empresa', empresa.id)
            .eq('id_producto', det.producto_id)
            .eq('id_tinta', det.id_tinta ?? 6)
            .single();
          // LOG para depuración
          console.log('[PUBLICAR] Empresa:', empresa.id, empresa.tipo_empresa, 'Producto:', det.producto_id, 'Tinta:', det.id_tinta ?? 6, 'Precio:', precioPersonalizado, 'Error:', logError);
          if (!precioPersonalizado || !precioPersonalizado.habilitado) {
            puedeCotizar = false;
            break;
          }
          const precio = Number(precioPersonalizado.valor_actualizado);
          if (!precio || isNaN(precio) || precio <= 0) {
            puedeCotizar = false;
            break;
          }
          montoTotal += ((Number(det.alto) * Number(det.ancho)) / 10000) * precio;
        }
        if (puedeCotizar) {
          try {
            // Verificar si la empresa existe en la tabla profiles
            const { data: empresaExistente, error: errorEmpresa } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', empresa.id)
              .single();

            if (errorEmpresa || !empresaExistente) {
              console.error('La empresa no existe en la tabla profiles:', empresa.id);
              continue;
            }

            // Verificar si ya existe una respuesta para esta empresa y cotización
            const { data: respuestaExistente, error: consultaError } = await supabase
              .from('respuestas_cotizacion')
              .select('id')
              .eq('cotizacion_id', cot.id)
              .eq('empresa_id', empresa.id)
              .maybeSingle();

            if (consultaError) {
              console.error('Error al verificar respuesta existente:', consultaError);
              continue;
            }

            const respuestaData = {
              cotizacion_id: cot.id,
              empresa_id: empresa.id,  // Este ID ya está verificado que existe en profiles
              monto: Math.round(montoTotal),
              fecha: new Date().toISOString(),
              estado: 'pendiente'
            };

            if (respuestaExistente) {
              // Si existe, actualizamos
              const { error: updateError } = await supabase
                .from('respuestas_cotizacion')
                .update(respuestaData)
                .eq('id', respuestaExistente.id);

              if (updateError) throw updateError;
            } else {
              // Si no existe, insertamos

              const { error: insertError } = await supabase
                .from('respuestas_cotizacion')
                .insert([respuestaData]);

              if (insertError) {
                console.error('Error al insertar respuesta:', insertError);
                throw insertError;
              }
            }
          } catch (error) {
            console.error('Error al guardar respuesta de cotización:', error);
            // Continuar con la siguiente empresa en caso de error
            continue;
          }
        }
      }
    } finally {
      // Refresca inmediatamente tras publicar para actualizar botones y estado visual
      await fetchCotizaciones();
      setCotizaciones(prev => prev.map(c => c.id === cot.id ? { ...c, publicando: false } : c));
    }
  }

  if (loading) return <div>Cargando historial...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 400, color: '#19223a', marginBottom: 16 }}>
        {role === 'empresa' ? 'Cotizaciones Asignadas' : 'Historial de Cotizaciones'}
      </h2>
      
      {role === 'empresa' && cotizaciones.length === 0 ? (
        <div style={{ margin: '20px 0', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
          No tienes cotizaciones asignadas actualmente.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Cotización</th>
                {role === 'cliente' && <th>Asignada</th>}
                <th>Venta</th>
                <th>Monto asignado</th>
                <th>Acciones</th>
                <th>Mensajes</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(cot => {
                const respuestasCot = Array.isArray(respuestas[cot.id]) ? respuestas[cot.id] : [];
                const ventaCotizacion = Array.isArray(ventas) ? ventas.find(v => v.cotizacion_id === cot.id) : null;
                const ofertaAsignada = respuestasCot.find(r => r.estado === 'asignada');
                
                // Mostrar "COT. Rechazadas" si no hay respuestas o todas están rechazadas
                const todasRechazadas = respuestasCot.length === 0 || 
                  (respuestasCot.length > 0 && respuestasCot.every(r => r.estado === 'rechazada'));
                
                const venta = Array.isArray(ventas) ? ventas.find(v => v.cotizacion_id === cot.id) : null;
                
                // Buscar monto de la empresa asignada
                let montoAsignado = '-';
                if (ofertaAsignada) {
                  montoAsignado = ofertaAsignada.monto !== undefined && ofertaAsignada.monto !== null
                    ? ofertaAsignada.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
                    : '-';
                }
            // Mostrar el estado de la asignación de la cotización
            let estadoAsignada = null;
            if (cot.estado === 'pendiente' || cot.estado === 'borrador' || cot.estado === 'pendiente a publicar') {
              estadoAsignada = <span style={{ color: '#888' }}>Sin publicar</span>;
            } else if (ofertaAsignada) {
              const nombreEmpresa = empresasInfo[ofertaAsignada.empresa_id];
              estadoAsignada = (
                <span style={{ color: '#43c463', fontWeight: 600 }}>
                  {nombreEmpresa || `Empresa (${ofertaAsignada.empresa_id.substring(0, 6)}...)`}
                </span>
              );
            } else if (todasRechazadas) {
              estadoAsignada = <span style={{ color: '#e74c3c', fontWeight: 600 }}>Rechazadas</span>;
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
                  {ofertaAsignada ? (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => abrirDetalleAsignada(cot, ofertaAsignada)}
                    >
                      Ver Cotización
                    </button>
                  ) : venta && venta.estado === 'pendiente' ? (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => handleIrANegociacion(venta, cot, empresasInfo[ofertaAsignada?.empresa_id] ? { id: ofertaAsignada?.empresa_id, nombre: empresasInfo[ofertaAsignada.empresa_id] } : null)}
                    >
                      Interactuar con la Empresa
                    </button>
                  ) : cot.estado === 'publicado' ? (
                    <button
                      style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                      onClick={() => setModalOfertas({ abierto: true, cotizacion: cot, precios: {} })}
                    >
                      Ver cotizaciones de empresas
                    </button>
                  ) : cot.estado === 'pendiente a publicar' && (
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
                  {ofertaAsignada && (
                    <button
                      onClick={() => handleIrANegociacion(venta || { cotizacion_id: cot.id }, cot, { id: ofertaAsignada.empresa_id, nombre: empresasInfo[ofertaAsignada.empresa_id] })}
                      style={{
                        background: 'transparent',
                        border: '1px solid #1976d2',
                        color: '#1976d2',
                        borderRadius: 5,
                        padding: '6px 12px',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        margin: '0 auto'
                      }}
                      title="Ver y enviar mensajes"
                    >
                      {tieneMensajesNuevosEnCotizacion(cot.id) ? (
                        <>
                          <span style={{ color: '#e67e22' }}>●</span>
                          <span>Nuevos mensajes</span>
                        </>
                      ) : (
                        <span>Ver mensajes</span>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            );
              })}
            </tbody>
          </table>
        </div>
      )}
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
