import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function EditarPreciosProductos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      setError('');
      const { data, error } = await supabase.from('productos').select('*');
      if (error) setError('Error al obtener productos');
      else setProductos(data);
      setLoading(false);
    };
    fetchProductos();
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

  if (loading) return <div>Cargando productos...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h3>Editar precios de productos</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Producto</th>
            <th>SKU</th>
            <th>Precio</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(producto => (
            <tr key={producto.id_producto}>
              <td>{producto.nombre_producto}</td>
              <td>{producto.codigo_sku}</td>
              <td>
                <input
                  type="number"
                  value={producto.precio}
                  min={0}
                  onChange={e => handlePrecioChange(producto.id_producto, e.target.value)}
                  style={{ width: 100 }}
                />
              </td>
              <td>
                <button onClick={() => handleGuardar(producto.id_producto, producto.precio)}>
                  Guardar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {success && <div style={{ color: 'green', marginTop: 12 }}>{success}</div>}
    </div>
  );
}

export default EditarPreciosProductos;
