import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function EditarPreciosInsumos() {
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState({}); // { id_producto: { valor_actualizado, updated_at } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      // Obtener usuario y empresa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('No autenticado');
        setLoading(false);
        return;
      }
      setEmpresaId(session.user.id);
      // Obtener nombre de la empresa
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
      // Obtener productos de insumos (SKU empieza con I-)
      const { data: productosData, error: prodError } = await supabase
        .from('productos')
        .select('*');
      if (prodError) {
        setError('Error al obtener insumos');
        setLoading(false);
        return;
      }
      const productosInsumos = productosData.filter(p => p.codigo_sku && p.codigo_sku.startsWith('I-'));
      setProductos(productosInsumos);
      // Obtener precios personalizados
      const { data: preciosData, error: preciosError } = await supabase
        .from('precios_actualizados')
        .select('id_producto, valor_actualizado, updated_at')
        .eq('id_empresa', session.user.id);
      if (!preciosError && preciosData) {
        const preciosMap = {};
        preciosData.forEach(p => {
          preciosMap[p.id_producto] = {
            valor: p.valor_actualizado,
            updated_at: p.updated_at
          };
        });
        setPrecios(preciosMap);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handlePrecioChange = (id_producto, nuevoPrecio) => {
    setPrecios({
      ...precios,
      [id_producto]: {
        valor: nuevoPrecio,
        updated_at: precios[id_producto]?.updated_at
      }
    });
  };

  const handleGuardar = async (id_producto) => {
    setError('');
    setSuccess('');
    const producto = productos.find(p => p.id_producto === id_producto);
    if (!producto) {
      setError('Insumo no encontrado');
      return;
    }
    const valor_actualizado = Number(precios[id_producto]?.valor);
    console.log('Datos enviados al upsert:', {
      id_empresa: empresaId,
      id_producto,
      valor_actualizado,
      nombre_empresa: nombreEmpresa
    });
    if (isNaN(valor_actualizado) || valor_actualizado <= 0) {
      setError('El precio debe ser un número válido y mayor a 0.');
      return;
    }
    // Construye el payload solo con los campos válidos
    const payload = {
      id_empresa: empresaId,
      id_producto,
      valor_actualizado,
      nombre_empresa: nombreEmpresa
    };
    // Elimina nombre_producto si accidentalmente se incluyera
    delete payload.nombre_producto;
    // UPSERT en precios_actualizados
    const { error } = await supabase.from('precios_actualizados').upsert([
      payload
    ], { onConflict: ['id_empresa', 'id_producto'] });
    if (error) setError('Error al actualizar el precio personalizado: ' + error.message);
    else setSuccess('Precio personalizado actualizado correctamente');
  };

  if (loading) return <div>Cargando insumos...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h3>Editar precios personalizados de insumos</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Insumo</th>
            <th>SKU</th>
            <th>Precio por defecto</th>
            <th>Precio personalizado</th>
            <th>Última actualización</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(producto => (
            <tr key={producto.id_producto}>
              <td>{producto.nombre_producto}</td>
              <td>{producto.codigo_sku}</td>
              <td>{producto.precio}</td>
              <td>
                <input
                  type="number"
                  value={precios[producto.id_producto]?.valor ?? ''}
                  min={0}
                  onChange={e => handlePrecioChange(producto.id_producto, e.target.value)}
                  style={{ width: 100 }}
                  placeholder="Sin personalizar"
                />
              </td>
              <td>{precios[producto.id_producto]?.updated_at ? new Date(precios[producto.id_producto].updated_at).toLocaleString() : '-'}</td>
              <td>
                <button onClick={() => handleGuardar(producto.id_producto)}>
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

export default EditarPreciosInsumos;
