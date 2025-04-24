import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import ProductAutocomplete from './ProductAutocomplete';
import ListadoOfertasCotizacion from './ListadoOfertasCotizacion';

function CotizarProducto({ onCotizacionGuardada }) {
  const [productos, setProductos] = useState([
    { producto_id: '', alto: '', ancho: '', nombre_producto: '', id_tinta: '', nombre_tinta: '' }
  ]);
  const [tintas, setTintas] = useState([]);
  const [productosTintas, setProductosTintas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ofertaCotizacion, setOfertaCotizacion] = useState(null); // Para mostrar ofertas tras publicar
  const [cotizacionId, setCotizacionId] = useState(null);
  const [detallesCot, setDetallesCot] = useState([]);

  useEffect(() => {
    const fetchTintas = async () => {
      const { data: tintasData } = await supabase.from('tintas').select('*');
      setTintas(tintasData || []);
      const { data: ptData } = await supabase.from('productos_tintas').select('*');
      setProductosTintas(ptData || []);
    };
    fetchTintas();
  }, []);

  const handleChange = (idx, field, value) => {
    const nuevos = [...productos];
    nuevos[idx][field] = value;
    setProductos(nuevos);
  };

  const handleSelectProducto = (idx, producto) => {
    const nuevos = [...productos];
    nuevos[idx].producto_id = producto.id_producto;
    nuevos[idx].nombre_producto = producto.nombre_producto;
    nuevos[idx].id_tinta = '';
    nuevos[idx].nombre_tinta = '';
    setProductos(nuevos);
  };

  const handleSelectTinta = (idx, id_tinta) => {
    const nuevos = [...productos];
    nuevos[idx].id_tinta = id_tinta;
    const tinta = tintas.find(t => t.id === Number(id_tinta));
    nuevos[idx].nombre_tinta = tinta ? tinta.nombre : '';
    setProductos(nuevos);
  };

  const handleAddProducto = () => {
    setProductos([...productos, { producto_id: '', alto: '', ancho: '', nombre_producto: '', id_tinta: '', nombre_tinta: '' }]);
  };

  const handleRemoveProducto = idx => {
    if (productos.length === 1) return;
    setProductos(productos.filter((_, i) => i !== idx));
  };

  const handleGuardar = async (publicar = false) => {
    setGuardando(true);
    setError('');
    setSuccess('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('No autenticado');
      // Obtener rol del usuario
      let userRole = 'cliente';
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile?.role) userRole = profile.role;
      // 1. Generar número de cotización incremental ÚNICO por cliente
      let nextNumber = 1;
      const { data: ultimaCot } = await supabase
        .from('cotizaciones')
        .select('numero_cotizacion')
        .eq('cliente_id', session.user.id)
        .order('id', { ascending: false })
        .limit(1)
        .single();
      if (ultimaCot && ultimaCot.numero_cotizacion) {
        const match = ultimaCot.numero_cotizacion.match(/COT-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      const numeroCotizacion = `COT-${nextNumber.toString().padStart(9, '0')}`;

      // LOG: Mostrar productos antes de guardar
      console.log('Productos a guardar en cotizacion:', productos);
      productos.forEach((prod, idx) => {
        console.log(`Producto[${idx}] producto_id:`, prod.producto_id, 'nombre_producto:', prod.nombre_producto, 'id_tinta:', prod.id_tinta);
      });

      // 2. Insertar cotización con el número generado
      const { data: cotData, error: cotError } = await supabase.from('cotizaciones').insert([
        {
          cliente_id: session.user.id,
          fecha: new Date().toISOString(),
          estado: 'pendiente a publicar',
          numero_cotizacion: numeroCotizacion
        }
      ]).select('*').single();
      if (cotError) {
        setError('Error guardando cotización: ' + cotError.message);
        setGuardando(false);
        return;
      }
      // 3. Insertar productos
      const detalles = [];
      for (const prod of productos) {
        if (!prod.producto_id || !prod.alto || !prod.ancho) throw new Error('Completa todos los campos de producto');
        // Si el producto tiene tintas asociadas, debe elegir una
        if (productosTintas.some(pt => pt.id_producto === prod.producto_id) && !prod.id_tinta) {
          throw new Error('Selecciona el tipo de tinta para cada producto');
        }
        const { data: detData, error: detError } = await supabase.from('cotizacion_detalle').insert([
          {
            cotizacion_id: cotData.id,
            producto_id: prod.producto_id,
            alto: Number(prod.alto),
            ancho: Number(prod.ancho),
            id_tinta: prod.id_tinta ? Number(prod.id_tinta) : null
          }
        ]).select('*').single();
        if (detError) throw detError;
        detalles.push(detData);
      }
      setSuccess('Cotización guardada como borrador');
      setProductos([{ producto_id: '', alto: '', ancho: '', nombre_producto: '', id_tinta: '', nombre_tinta: '' }]);
      if (onCotizacionGuardada) onCotizacionGuardada();
      return;
    } catch (e) {
      setError(e.message || 'Error al guardar cotización');
    } finally {
      setGuardando(false);
    }
  };

  // Aceptar/rechazar ofertas
  const handleAceptarOferta = async (empresaId) => {
    if (!cotizacionId) return;
    // 1. Marcar la oferta aceptada en respuestas_cotizacion
    await supabase.from('respuestas_cotizacion')
      .update({ estado: 'aceptada' })
      .eq('cotizacion_id', cotizacionId)
      .eq('empresa_id', empresaId);
    // 2. Marcar las demás como rechazadas
    await supabase.from('respuestas_cotizacion')
      .update({ estado: 'rechazada' })
      .eq('cotizacion_id', cotizacionId)
      .neq('empresa_id', empresaId);
    setOfertaCotizacion(false);
    setSuccess('Oferta aceptada. Las demás han sido rechazadas.');
    setProductos([{ producto_id: '', alto: '', ancho: '', nombre_producto: '', id_tinta: '', nombre_tinta: '' }]);
    if (onCotizacionGuardada) onCotizacionGuardada();
  };
  const handleRechazarOferta = async (empresaId) => {
    if (!cotizacionId) return;
    await supabase.from('respuestas_cotizacion')
      .update({ estado: 'rechazada' })
      .eq('cotizacion_id', cotizacionId)
      .eq('empresa_id', empresaId);
    setSuccess('Oferta rechazada.');
  };

  return (
    <div>
      <h3 style={{ marginTop: 0, fontWeight: 700, fontSize: 22 }}>Cotizar Producto</h3>
      {ofertaCotizacion ? (
        <ListadoOfertasCotizacion
          cotizacionId={cotizacionId}
          detalles={detallesCot}
          onAceptar={handleAceptarOferta}
          onRechazar={handleRechazarOferta}
        />
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 6px 32px #0002',
          padding: '32px 36px 28px 36px',
          minWidth: 600,
          maxWidth: 900,
          margin: '0 auto',
          marginTop: 10
        }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginBottom: 18, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f6f6fa' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 700, fontSize: 17, borderRadius: '12px 0 0 0', width: '25%' }}>Producto</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700, fontSize: 17, width: '22%' }}>Tipo de tinta</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700, fontSize: 17, width: '18%' }}>Ancho (cm)</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700, fontSize: 17, borderRadius: '0 12px 0 0', width: '18%' }}>Alto (cm)</th>
                <th style={{ width: '10%', background: 'transparent' }}></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((prod, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#fafcff' : '#fff' }}>
                  <td style={{ padding: '8px 6px', minWidth: 120, maxWidth: 180 }}>
                    <ProductAutocomplete
                      value={prod.producto_id}
                      nombre={prod.nombre_producto}
                      onSelect={p => handleSelectProducto(idx, p)}
                    />
                    {/* {prod.nombre_producto && <div style={{ color: '#888', fontSize: 13 }}>{prod.nombre_producto}</div>} */}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', minWidth: 110, maxWidth: 200 }}>
                    {prod.producto_id && productosTintas.some(pt => pt.id_producto === prod.producto_id) ? (
                      <select
                        value={prod.id_tinta}
                        onChange={e => handleSelectTinta(idx, e.target.value)}
                        style={{ width: '95%', minWidth: 90, maxWidth: 170, padding: 7, borderRadius: 8, border: '1px solid #c8c8c8', fontSize: 15 }}
                      >
                        <option value="">Selecciona tinta</option>
                        {productosTintas.filter(pt => pt.id_producto === prod.producto_id).map(pt => {
                          const tinta = tintas.find(t => t.id === pt.id_tinta);
                          return tinta ? (
                            <option key={tinta.id} value={tinta.id}>{tinta.nombre}</option>
                          ) : null;
                        })}
                      </select>
                    ) : (
                      <span style={{ color: '#888', fontSize: 13 }}>N/A</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', minWidth: 70, maxWidth: 120 }}>
                    <input
                      type="number"
                      value={prod.ancho}
                      min={1}
                      style={{ width: '90%', minWidth: 60, maxWidth: 100, padding: 7, borderRadius: 8, border: '1px solid #c8c8c8', fontSize: 16 }}
                      onChange={e => handleChange(idx, 'ancho', e.target.value)}
                      placeholder="Ancho"
                    />
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', minWidth: 70, maxWidth: 120 }}>
                    <input
                      type="number"
                      value={prod.alto}
                      min={1}
                      style={{ width: '90%', minWidth: 60, maxWidth: 100, padding: 7, borderRadius: 8, border: '1px solid #c8c8c8', fontSize: 16 }}
                      onChange={e => handleChange(idx, 'alto', e.target.value)}
                      placeholder="Alto"
                    />
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', minWidth: 20, maxWidth: 60 }}>
                    {productos.length > 1 && (
                      <button
                        style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
                        onClick={() => handleRemoveProducto(idx)}
                        title="Quitar producto"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, alignItems: 'center', marginBottom: 18 }}>
            <button
              style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 26px', fontWeight: 700, fontSize: 17, cursor: 'pointer', boxShadow: '0 2px 8px #1976d233' }}
              onClick={handleAddProducto}
            >
              + Agregar otro producto
            </button>
          </div>
          <div style={{ textAlign: 'right', marginTop: 18 }}>
            <button
              style={{ background: '#43c463', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 34px', fontWeight: 800, fontSize: 19, cursor: 'pointer', boxShadow: '0 2px 8px #43c46333' }}
              onClick={handleGuardar}
            >
              Guardar cotización
            </button>
          </div>
        </div>
      )}
      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: 10 }}>{success}</div>}
    </div>
  );
}

export default CotizarProducto;
