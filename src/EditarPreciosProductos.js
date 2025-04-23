import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { supabase } from './supabaseClient';

function EditarPreciosProductos() {
  const [productos, setProductos] = useState([]);
  const [tintas, setTintas] = useState([]);
  const [productosTintas, setProductosTintas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      // Productos
      const { data: productosData, error: prodError } = await supabase.from('productos').select('*');
      if (prodError) {
        setError('Error al obtener productos');
        setLoading(false);
        return;
      }
      setProductos(productosData || []);
      // Tintas
      const { data: tintasData, error: tintasError } = await supabase.from('tintas').select('*');
      if (tintasError) {
        setError('Error al obtener tintas');
        setLoading(false);
        return;
      }
      setTintas(tintasData || []);
      // Relación productos_tintas
      const { data: ptData, error: ptError } = await supabase.from('productos_tintas').select('*');
      if (ptError) {
        setError('Error al obtener relación productos-tintas');
        setLoading(false);
        return;
      }
      setProductosTintas(ptData || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handlePrecioChange = (id_producto, nuevoPrecio) => {
    setProductos(productos.map(p =>
      p.id_producto === id_producto ? { ...p, precio: nuevoPrecio } : p
    ));
  };

  const handleGuardar = async (id_producto, precio) => {
    setError('');
    setSuccess('');
    const { error } = await supabase
      .from('productos')
      .update({ precio })
      .eq('id_producto', id_producto);
    if (error) setError('Error al actualizar el precio');
    else setSuccess('Precio actualizado correctamente');
  };

  const handleTintasChange = async (id_producto, selectedOptions) => {
    setError('');
    setSuccess('');
    const nuevasTintas = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    const actuales = productosTintas.filter(pt => pt.id_producto === id_producto).map(pt => pt.id_tinta);
    const aAgregar = nuevasTintas.filter(id => !actuales.includes(id));
    const aQuitar = actuales.filter(id => !nuevasTintas.includes(id));
    // Agregar nuevas
    for (let id_tinta of aAgregar) {
      await supabase.from('productos_tintas').insert([{ id_producto, id_tinta }]);
    }
    // Quitar
    for (let id_tinta of aQuitar) {
      await supabase.from('productos_tintas').delete().eq('id_producto', id_producto).eq('id_tinta', id_tinta);
    }
    // Refrescar
    const { data: ptData, error: ptError } = await supabase.from('productos_tintas').select('*');
    if (ptError) setError('Error al actualizar relación productos-tintas');
    setProductosTintas(ptData || []);
    setSuccess('Tintas actualizadas para el producto');
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 900, margin: '32px auto' }}>
      <h3 style={{ marginBottom: 24, fontWeight: 700 }}>Gestionar tintas permitidas por producto</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ width: 300, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Producto</th>
            <th style={{ width: 200, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Precio</th>
            <th style={{ width: 400, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Tintas permitidas</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(producto => {
            const tintasAsociadas = productosTintas
              .filter(pt => pt.id_producto === producto.id_producto)
              .map(pt => pt.id_tinta);
            return (
              <tr key={producto.id_producto} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.2s' }}>
                <td style={{ padding: '8px 6px' }}>{producto.nombre_producto}</td>
                <td style={{ padding: '8px 6px' }}>
                  <input
                    type="number"
                    value={producto.precio}
                    min={0}
                    onChange={e => handlePrecioChange(producto.id_producto, e.target.value)}
                    style={{ width: 100 }}
                  />
                  <button onClick={() => handleGuardar(producto.id_producto, producto.precio)}>
                    Guardar
                  </button>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <Select
                    isMulti
                    options={tintas.map(t => ({ value: t.id, label: t.nombre }))}
                    value={tintas
                      .filter(t => tintasAsociadas.includes(t.id))
                      .map(t => ({ value: t.id, label: t.nombre }))}
                    onChange={selected => handleTintasChange(producto.id_producto, selected)}
                    placeholder="Selecciona tintas..."
                    styles={{
                      control: (base) => ({ ...base, minHeight: 38, borderRadius: 6, fontSize: 15 }),
                      multiValue: (base) => ({ ...base, background: '#e0e7ef', borderRadius: 4 })
                    }}
                  />
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

export default EditarPreciosProductos;
