import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import PriceInputControlado from './PriceInputControlado';

function EditarPreciosPersonalizados({ tipoEmpresa }) {
  const [productos, setProductos] = useState([]);
  const [tintas, setTintas] = useState([]);
  const [precios, setPrecios] = useState({}); // { [id_producto]: { [id_tinta]: { precio, updated_at, habilitado } } }
  const [habilitadoPrecios, setHabilitadoPrecios] = useState({}); // { [id_producto]: { [id_tinta]: true/false } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [productosTintas, setProductosTintas] = useState([]); // Relación producto-tinta

  // --- Ventana modal para mensajes ---
  const [showModal, setShowModal] = useState(false);
  useEffect(() => {
    if (success) {
      setShowModal(true);
      const timer = setTimeout(() => setShowModal(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      // Obtener sesión y empresa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('No autenticado');
        setLoading(false);
        return;
      }
      setEmpresaId(session.user.id);
      // Nombre empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('nombre')
        .eq('id', session.user.id)
        .single();
      if (empresaError || !empresaData) {
        setError('No se pudo obtener el nombre de la empresa');
        setLoading(false);
        return;
      }
      setNombreEmpresa(empresaData.nombre);
      // Productos
      const { data: productosData, error: prodError } = await supabase.from('productos').select('*');
      if (prodError) {
        setError('Error al obtener productos');
        setLoading(false);
        return;
      }
      setProductos(productosData);
      // Tintas (catálogo)
      const { data: tintasData, error: tintasError } = await supabase.from('tintas').select('*');
      if (tintasError) {
        setError('Error al obtener tintas');
        setLoading(false);
        return;
      }
      setTintas(tintasData);
      // Obtener productos_tintas para saber qué tintas tiene cada producto
      const { data: productosTintasData, error: productosTintasError } = await supabase
        .from('productos_tintas')
        .select('id_producto, id_tinta');
      if (productosTintasError) {
        setError('Error al obtener relación producto-tinta');
        setLoading(false);
        return;
      }
      setProductosTintas(productosTintasData);
      // Precios personalizados
      const { data: preciosData, error: preciosError } = await supabase
        .from('precios_actualizados')
        .select('id_producto, id_tinta, valor_actualizado, updated_at, habilitado')
        .eq('id_empresa', session.user.id);
      if (preciosError) {
        setError('Error al obtener precios personalizados');
        setLoading(false);
        return;
      }
      // Organizar precios por producto y tinta
      const preciosMap = {};
      preciosData.forEach(p => {
        if (!preciosMap[p.id_producto]) preciosMap[p.id_producto] = {};
        preciosMap[p.id_producto][p.id_tinta] = {
          precio: p.valor_actualizado,
          updated_at: p.updated_at,
          habilitado: p.habilitado
        };
      });
      setPrecios(preciosMap);
      setLoading(false);
    };
    fetchData();
  }, [tipoEmpresa]);

  useEffect(() => {
    if (Object.keys(precios).length > 0) {
      const next = {};
      Object.entries(precios).forEach(([id_producto, porTinta]) => {
        next[id_producto] = {};
        Object.entries(porTinta).forEach(([id_tinta, datos]) => {
          next[id_producto][id_tinta] = datos.habilitado !== false; // por defecto true
        });
      });
      setHabilitadoPrecios(next);
    }
  }, [precios]);

  const handleGuardar = async (id_producto, id_tinta, precioFinal) => {
    setError('');
    setSuccess('');
    console.log('[handleGuardar] Click en guardar:', { id_producto, id_tinta, precioFinal, empresaId, habilitado: habilitadoPrecios[id_producto]?.[id_tinta] });
    // Permite id_tinta == null para productos sin tinta
    if (!empresaId || !id_producto || id_tinta == null || isNaN(precioFinal) || precioFinal <= 0 || habilitadoPrecios[id_producto]?.[id_tinta] === false) {
      setError(habilitadoPrecios[id_producto]?.[id_tinta] === false ? 'No puedes guardar porque la venta está deshabilitada.' : 'El precio debe ser mayor a 0');
      setShowModal(true); // Mostrar modal de error
      setTimeout(() => setShowModal(false), 1500); // Ocultar modal tras 1.5s
      console.log('[handleGuardar] BLOQUEADO por validación');
      return;
    }
    try {
      const payload = {
        id_empresa: empresaId,
        id_producto,
        valor_actualizado: precioFinal,
        updated_at: new Date().toISOString(),
        nombre_empresa: nombreEmpresa
      };
      if (id_tinta != null) payload.id_tinta = Number(id_tinta);
      console.log('[handleGuardar] Payload a enviar:', payload);
      const { error, data } = await supabase.from('precios_actualizados').upsert([
        payload
      ], { onConflict: id_tinta != null ? ['id_empresa', 'id_producto', 'id_tinta'] : ['id_empresa', 'id_producto'] });
      console.log('[handleGuardar] Supabase response:', { error, data });
      if (error) {
        setError('Error al actualizar el precio personalizado: ' + error.message);
        console.log('[handleGuardar] ERROR:', error.message, error.details, error.hint);
      } else {
        setSuccess('Precio personalizado actualizado correctamente');
        // Refresca desde la base de datos para asegurar sincronía
        const { data: preciosData, error: preciosError } = await supabase
          .from('precios_actualizados')
          .select('id_producto, id_tinta, valor_actualizado, updated_at, habilitado')
          .eq('id_empresa', empresaId);
        if (!preciosError) {
          const preciosObj = {};
          preciosData.forEach(p => {
            if (!preciosObj[p.id_producto]) preciosObj[p.id_producto] = {};
            preciosObj[p.id_producto][p.id_tinta] = {
              precio: p.valor_actualizado,
              updated_at: p.updated_at,
              habilitado: p.habilitado
            };
          });
          setPrecios(preciosObj);
        }
      }
    } catch (e) {
      setError('Error inesperado al actualizar el precio personalizado');
      console.log('[handleGuardar] EXCEPCION:', e);
    }
  };

  const handleToggleVenta = async (id_producto, id_tinta) => {
    const current = habilitadoPrecios[id_producto]?.[id_tinta] ?? false;
    const nuevoEstado = !current;

    // Busca el valor_actualizado actual o el precio por defecto
    let valor_actualizado = precios[id_producto]?.[id_tinta]?.precio;
    if (valor_actualizado == null) {
      // Busca precio por defecto según tinta
      const producto = productos.find(p => p.id_producto === id_producto);
      const tintaObj = tintas.find(t => t.id === id_tinta);
      if (producto && tintaObj) {
        if (tintaObj.nombre?.toLowerCase().includes('solvent')) valor_actualizado = producto.precio_solvente;
        else if (tintaObj.nombre?.toLowerCase().includes('eco')) valor_actualizado = producto.precio_ecosolvente;
        else if (tintaObj.nombre?.toLowerCase().includes('uv')) valor_actualizado = producto.precio_uv;
        else if (tintaObj.nombre?.toLowerCase().includes('latex')) valor_actualizado = producto.precio_latex;
        else if (tintaObj.nombre?.toLowerCase().includes('resina')) valor_actualizado = producto.precio_resina;
        else valor_actualizado = producto.precio;
      }
    }
    if (valor_actualizado == null) valor_actualizado = 1;

    console.log('[handleToggleVenta] Payload:', {
      id_empresa: empresaId,
      id_producto,
      id_tinta,
      valor_actualizado,
      habilitado: nuevoEstado,
      updated_at: new Date().toISOString(),
      nombre_empresa: nombreEmpresa
    });

    setHabilitadoPrecios(prev => ({
      ...prev,
      [id_producto]: {
        ...prev[id_producto],
        [id_tinta]: nuevoEstado
      }
    }));

    const { error, data } = await supabase.from('precios_actualizados').upsert([
      {
        id_empresa: empresaId,
        id_producto,
        id_tinta,
        valor_actualizado,
        habilitado: nuevoEstado,
        updated_at: new Date().toISOString(),
        nombre_empresa: nombreEmpresa
      }
    ], { onConflict: ['id_empresa', 'id_producto', 'id_tinta'] });
    console.log('[handleToggleVenta] Supabase response:', { error, data });

    if (error) {
      setError('Error al actualizar el estado de venta: ' + error.message);
      setHabilitadoPrecios(prev => ({
        ...prev,
        [id_producto]: {
          ...prev[id_producto],
          [id_tinta]: current
        }
      }));
      return;
    }
    // Refresca precios para reflejar el cambio real
    const { data: preciosData, error: preciosError } = await supabase
      .from('precios_actualizados')
      .select('id_producto, id_tinta, valor_actualizado, updated_at, habilitado')
      .eq('id_empresa', empresaId);
    console.log('[handleToggleVenta] Refreshed precios_actualizados:', { preciosData, preciosError });
    if (!preciosError) {
      const preciosObj = {};
      const habilitadoObj = {};
      preciosData.forEach(p => {
        if (!preciosObj[p.id_producto]) preciosObj[p.id_producto] = {};
        if (!habilitadoObj[p.id_producto]) habilitadoObj[p.id_producto] = {};
        preciosObj[p.id_producto][p.id_tinta] = { precio: p.valor_actualizado, updated_at: p.updated_at, habilitado: p.habilitado };
        habilitadoObj[p.id_producto][p.id_tinta] = p.habilitado;
      });
      setPrecios(preciosObj);
      setHabilitadoPrecios(habilitadoObj);
    }
  };

  if (loading) return <div>Cargando productos...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <>
      {/* Modal de éxito */}
      {showModal && success && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#d1fae5', color: '#065f46', padding: '28px 44px', borderRadius: 14, fontWeight: 700, fontSize: 22, border: '2px solid #10b981', boxShadow: '0 4px 32px rgba(16,185,129,0.09)'
          }}>
            {success}
          </div>
        </div>
      )}
      {/* Modal de error */}
      {showModal && error && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fef2f2', color: '#ef4444', padding: '28px 44px', borderRadius: 14, fontWeight: 700, fontSize: 22, border: '2px solid #f87171', boxShadow: '0 4px 32px rgba(239,68,68,0.09)'
          }}>
            {error}
          </div>
        </div>
      )}
      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 1200, margin: '32px auto' }}>
        <h3 style={{ marginBottom: 24, fontWeight: 700 }}>Editar precios personalizados de productos</h3>
        {error && (
          <div style={{ color: 'red', background: '#fef2f2', padding: '10px 18px', borderRadius: 8, marginBottom: 18, fontWeight: 600, fontSize: 16, border: '1px solid #f87171', boxShadow: '0 1px 6px rgba(239,68,68,0.06)'}}>{error}</div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ width: 200, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Producto</th>
              <th style={{ width: 600, padding: '10px 6px', fontWeight: 600, textAlign: 'center' }}>Precios por tinta</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(producto => {
              const tintasAsociadas = productosTintas
                .filter(pt => pt.id_producto === producto.id_producto)
                .map(pt => tintas.find(t => t.id === pt.id_tinta))
                .filter(Boolean);
              return (
                <tr key={producto.id_producto} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.2s' }}>
                  <td style={{ padding: '8px 6px' }}>{producto.nombre_producto}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    {tintasAsociadas.length > 0 ? (
                      <table style={{ width: '100%', background: 'none', border: 'none', boxShadow: 'none' }}>
                        <thead>
                          <tr>
                            <th style={{ fontWeight: 600, padding: '2px 8px' }}>Tinta</th>
                            <th style={{ fontWeight: 600, padding: '2px 8px' }}>Precio por defecto</th>
                            <th style={{ fontWeight: 600, padding: '2px 8px' }}>Precio</th>
                            <th style={{ fontWeight: 600, padding: '2px 8px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tintasAsociadas.map(tinta => {
                            const enabled = habilitadoPrecios[producto.id_producto]?.[tinta.id] ?? false;
                            let precioPorDefecto = '';
                            if (tinta.nombre?.toLowerCase().includes('solvent')) {
                              precioPorDefecto = producto.precio_solvente;
                            } else if (tinta.nombre?.toLowerCase().includes('eco')) {
                              precioPorDefecto = producto.precio_ecosolvente;
                            } else if (tinta.nombre?.toLowerCase().includes('uv')) {
                              precioPorDefecto = producto.precio_uv;
                            } else if (tinta.nombre?.toLowerCase().includes('latex')) {
                              precioPorDefecto = producto.precio_latex;
                            } else if (tinta.nombre?.toLowerCase().includes('resina')) {
                              precioPorDefecto = producto.precio_resina;
                            } else {
                              precioPorDefecto = producto.precio;
                            }
                            // Elimina el 0 visualmente
                            const mostrarPrecio = precios[producto.id_producto]?.[tinta.id]?.precio;
                            return (
                              <tr key={tinta.id}>
                                <td style={{ padding: '2px 8px', textAlign: 'left', fontWeight: 500 }}>{tinta.nombre}</td>
                                <td style={{ padding: '2px 8px', color: '#64748b', fontWeight: 500, background: '#f1f5f9', minWidth: 70 }}>{precioPorDefecto ?? ''}</td>
                                <td style={{ padding: '2px 8px' }}>
                                  <PriceInputControlado
                                    initialValue={mostrarPrecio && mostrarPrecio !== 0 ? mostrarPrecio : ''}
                                    disabled={!enabled}
                                    placeholder={!enabled ? 'Sin personaliz' : undefined}
                                    onSave={precio => handleGuardar(producto.id_producto, tinta.id, precio)}
                                  />
                                </td>
                                <td style={{ padding: '2px 8px' }}>
                                  <button
                                    onClick={() => handleToggleVenta(producto.id_producto, tinta.id)}
                                    style={{
                                      background: enabled ? '#16a34a' : '#ef4444',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 5,
                                      padding: '6px 12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      fontSize: 14
                                    }}
                                  >
                                    {enabled ? 'Venta habilitada' : 'Venta deshabilitada'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      // Si no tiene tintas asociadas, deja el comportamiento anterior (input único)
                      <>
                        <span style={{ color: '#64748b', fontWeight: 500, background: '#f1f5f9', minWidth: 70, marginRight: 12, padding: '4px 10px', borderRadius: 6 }}>{producto.precio ?? ''}</span>
                        <PriceInputControlado
                          initialValue={precios[producto.id_producto]?.['default']?.precio ?? ''}
                          disabled={false}
                          onSave={precio => handleGuardar(producto.id_producto, null, precio)}
                        />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default EditarPreciosPersonalizados;
