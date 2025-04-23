import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { supabase } from './supabaseClient';

function EditarPreciosPersonalizados({ tipoEmpresa }) {
  const [productos, setProductos] = useState([]);
  const [tintas, setTintas] = useState([]);
  const [productosTintas, setProductosTintas] = useState([]); // Relación producto-tinta
  const [precios, setPrecios] = useState({}); // { [id_producto]: { [id_tinta]: { precio, updated_at } } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');

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
      // Relación producto-tinta
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
        .from('precios_personalizados')
        .select('id_producto, id_tinta, precio, updated_at')
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
          precio: p.precio,
          updated_at: p.updated_at
        };
      });
      setPrecios(preciosMap);
      setLoading(false);
    };
    fetchData();
  }, [tipoEmpresa]);

  const handleTintasChange = async (id_producto, selectedOptions) => {
    setError('');
    setSuccess('');
    const nuevasTintas = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    const actuales = productosTintas.filter(pt => pt.id_producto === id_producto).map(pt => pt.id_tinta);
    const aAgregar = nuevasTintas.filter(id => !actuales.includes(id));
    const aQuitar = actuales.filter(id => !nuevasTintas.includes(id));
    console.log('TINTAS NUEVAS:', nuevasTintas);
    console.log('TINTAS ACTUALES:', actuales);
    console.log('A AGREGAR:', aAgregar);
    console.log('A QUITAR:', aQuitar);
    // Agregar nuevas tintas: inserta en la base y actualiza el estado local al instante
    if (aAgregar.length > 0) {
      for (let id_tinta of aAgregar) {
        supabase.from('productos_tintas').insert([{ id_producto, id_tinta }]); // asíncrono
      }
      // Actualiza el estado local productosTintas inmediatamente
      setProductosTintas(prev => [
        ...prev,
        ...aAgregar.map(id_tinta => ({ id_producto, id_tinta }))
      ]);
    }
    // Borrado batch y asíncrono para máxima velocidad
    if (aQuitar.length > 0) {
      supabase
        .from('productos_tintas')
        .delete()
        .eq('id_producto', id_producto)
        .in('id_tinta', aQuitar);
      supabase
        .from('precios_personalizados')
        .delete()
        .eq('id_producto', id_producto)
        .eq('id_empresa', empresaId)
        .in('id_tinta', aQuitar);
    }
    // Actualiza el estado local productosTintas inmediatamente, sin esperar Supabase
    setProductosTintas(prev =>
      prev.filter(pt => !(pt.id_producto === id_producto && aQuitar.includes(pt.id_tinta)))
    );
    // Limpieza extra: elimina precios de tintas que ya no están asociadas tras el refresh
    setPrecios(prev => {
      const nuevo = { ...prev };
      if (nuevo[id_producto]) {
        Object.keys(nuevo[id_producto]).forEach(id_tinta => {
          if (aQuitar.includes(Number(id_tinta))) {
            delete nuevo[id_producto][id_tinta];
            console.log('LIMPIANDO tras quitar', { id_producto, id_tinta });
          }
        });
      }
      return nuevo;
    });
    setSuccess('Tintas actualizadas para el producto');
    console.log('REFRESH productosTintas (local)', productosTintas);
  };

  const handlePrecioChange = (id_producto, id_tinta, valor) => {
    setPrecios(prev => ({
      ...prev,
      [id_producto]: {
        ...prev[id_producto],
        [id_tinta]: {
          ...prev[id_producto]?.[id_tinta],
          precio: valor
        }
      }
    }));
  };

  const handleGuardar = async (id_producto, id_tinta) => {
    setError('');
    setSuccess('');
    const precio = Number(precios[id_producto]?.[id_tinta]?.precio);
    if (isNaN(precio) || precio <= 0) {
      setError('El precio debe ser un número válido y mayor a 0.');
      return;
    }
    const { error } = await supabase.from('precios_personalizados').upsert([
      {
        id_empresa: empresaId,
        id_producto,
        id_tinta,
        precio,
        updated_at: new Date().toISOString(),
      }
    ], { onConflict: ['id_empresa', 'id_producto', 'id_tinta'] });
    if (error) setError('Error al actualizar el precio personalizado');
    else setSuccess('Precio personalizado actualizado correctamente');
  };

  if (loading) return <div>Cargando productos...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  // Opciones de tintas para el multi-select
  const tintaOptions = tintas.map(t => ({ value: t.id, label: t.nombre }));

  // IDs de tintas por nombre estándar
  const tintaIdPorNombre = {};
  tintas.forEach(t => {
    tintaIdPorNombre[t.nombre.trim().toUpperCase()] = t.id;
  });

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 1200, margin: '32px auto' }}>
      <h3 style={{ marginBottom: 24, fontWeight: 700 }}>Editar precios personalizados de productos</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ width: 200, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Producto</th>
            <th style={{ width: 300, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Tintas permitidas</th>
            <th style={{ width: 600, padding: '10px 6px', fontWeight: 600, textAlign: 'center' }}>Precio Personalizado</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(producto => {
            const tintasAsociadas = productosTintas
              .filter(pt => pt.id_producto === producto.id_producto)
              .map(pt => pt.id_tinta);
            const selectedTintas = tintas
              .filter(t => tintasAsociadas.includes(t.id))
              .map(t => ({ value: t.id, label: t.nombre }));
            return (
              <tr key={producto.id_producto} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.2s' }}>
                <td style={{ padding: '8px 6px' }}>{producto.nombre_producto}</td>
                <td style={{ padding: '8px 6px' }}>
                  <Select
                    isMulti
                    options={tintaOptions}
                    value={selectedTintas}
                    onChange={selected => handleTintasChange(producto.id_producto, selected)}
                    placeholder="Selecciona tintas..."
                    styles={{
                      control: (base) => ({ ...base, minHeight: 38, borderRadius: 6, fontSize: 15 }),
                      multiValue: (base) => ({ ...base, background: '#e0e7ef', borderRadius: 4 })
                    }}
                  />
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  {["ECO-SOLVENTADAS", "SOLVENTADAS", "UV", "RESINA", "LATEX"].map(nombreTinta => {
                    const tintaId = tintaIdPorNombre[nombreTinta];
                    if (!tintaId || !tintasAsociadas.includes(tintaId)) return null;
                    const precioPersonalizado = precios[producto.id_producto]?.[tintaId]?.precio ?? '';
                    return (
                      <div key={tintaId} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ minWidth: 130, fontWeight: 500 }}>{`Precio ${nombreTinta.replace('-', ' ')}`}</span>
                        <input
                          type="number"
                          value={precioPersonalizado}
                          min={0}
                          onChange={e => handlePrecioChange(producto.id_producto, tintaId, e.target.value)}
                          style={{ width: 110, padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 5, background: '#f9fafb', fontSize: 15, marginLeft: 10 }}
                          placeholder="Sin personalizar"
                        />
                        <button
                          onClick={() => handleGuardar(producto.id_producto, tintaId)}
                          disabled={precioPersonalizado === '' || precioPersonalizado === null}
                          style={{
                            background: (precioPersonalizado === '' || precioPersonalizado === null) ? '#e2e8f0' : '#2563eb',
                            color: (precioPersonalizado === '' || precioPersonalizado === null) ? '#64748b' : '#fff',
                            border: 'none',
                            borderRadius: 5,
                            padding: '6px 16px',
                            fontWeight: 600,
                            cursor: (precioPersonalizado === '' || precioPersonalizado === null) ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                            marginLeft: 12
                          }}
                        >
                          Guardar
                        </button>
                      </div>
                    );
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {success && <div style={{ color: '#059669', background: '#ecfdf5', borderRadius: 6, padding: '10px 18px', marginTop: 18, fontWeight: 600 }}>{success}</div>}
    </div>
  );
}

export default EditarPreciosPersonalizados;
