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
  const [empresas, setEmpresas] = useState([]);
  const [empresaMsg, setEmpresaMsg] = useState('');

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

  useEffect(() => {
    const fetchEmpresas = async () => {
      const { data, error } = await supabase.from('empresas').select('id, nombre, estado');
      if (!error && data) setEmpresas(data);
    };
    fetchEmpresas();
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

  const toggleEstadoEmpresa = async (empresaId, estadoActual) => {
    setEmpresaMsg('');
    const nuevoEstado = estadoActual === 'Habilitada para vender' ? 'Deshabilitada para vender' : 'Habilitada para vender';
    const { error } = await supabase.from('empresas').update({ estado: nuevoEstado }).eq('id', empresaId);
    if (!error) {
      setEmpresas(empresas.map(e => e.id === empresaId ? { ...e, estado: nuevoEstado } : e));
      setEmpresaMsg('Estado de empresa actualizado');
    } else {
      setEmpresaMsg('Error al actualizar estado');
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 900, margin: '32px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 0 }}>Editar precios personalizados de productos</h3>
        <button
          style={{
            padding: '10px 32px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            marginLeft: 12
          }}
        >
          Gestión de empresas (always visible)
        </button>
      </div>
      <div style={{ marginBottom: 32, background: '#fbbf24', padding: 16, borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12 }}>Empresas de Publicidad Gráfica</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ width: 300, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Empresa</th>
              <th style={{ width: 200, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Estado</th>
              <th style={{ width: 200, padding: '10px 6px', fontWeight: 600, textAlign: 'left' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(emp => (
              <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                <td style={{ padding: '8px 6px' }}>{emp.nombre}</td>
                <td style={{ padding: '8px 6px' }}>{emp.estado}</td>
                <td style={{ padding: '8px 6px' }}>
                  <button
                    onClick={() => toggleEstadoEmpresa(emp.id, emp.estado)}
                    style={{
                      padding: '6px 18px',
                      background: emp.estado === 'Habilitada para vender' ? '#e11d48' : '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer'
                    }}
                  >
                    {emp.estado === 'Habilitada para vender' ? 'Deshabilitar' : 'Habilitar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {empresaMsg && <div style={{ color: empresaMsg.includes('Error') ? 'red' : '#059669', marginTop: 10 }}>{empresaMsg}</div>}
      </div>
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
