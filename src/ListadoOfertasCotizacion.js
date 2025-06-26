import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function ListadoOfertasCotizacion({ cotizacionId, detalles, onAceptar, onRechazar }) {
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visualizar, setVisualizar] = useState(null);

  useEffect(() => {
    const fetchOfertas = async () => {
      setLoading(true);
      setError('');
      // Obtener empresas de publicidad grafica
      const { data: empresas, error: empresasError } = await supabase
        .from('profiles')
        .select('id, display_name as nombre')
        .eq('role', 'empresa')
        .eq('tipo_empresa', 'publicidad');
      if (empresasError) {
        setError('No se pudieron obtener las empresas');
        setLoading(false);
        return;
      }
      // Calcular monto personalizado por empresa
      const ofertasArr = [];
      for (const empresa of empresas) {
        let montoTotal = 0;
        let puedeCotizar = true;
        console.log('[LOG] Empresa:', empresa.nombre, 'ID:', empresa.id);
        for (const det of detalles) {
          let precio = 0;
          console.log('[LOG] Revisando producto:', det.producto_id, 'tinta:', det.id_tinta ?? 6);
          const { data: precioPersonalizado, error: logError } = await supabase
            .from('precios_actualizados')
            .select('valor_actualizado, habilitado')
            .eq('id_empresa', empresa.id)
            .eq('id_producto', det.producto_id)
            .eq('id_tinta', det.id_tinta ?? 6)
            .single();
          console.log('[LOG] Resultado precios_actualizados:', precioPersonalizado, 'Error:', logError);
          if (!precioPersonalizado || !precioPersonalizado.habilitado) {
            console.log('[LOG] Empresa', empresa.nombre, 'NO puede cotizar este producto/tinta.');
            puedeCotizar = false;
            break;
          }
          precio = Number(precioPersonalizado.valor_actualizado);
          if (!precio || isNaN(precio) || precio <= 0) {
            console.log('[LOG] Empresa', empresa.nombre, 'NO vende (precio inválido) el producto/tinta.');
            puedeCotizar = false;
            break;
          }
          montoTotal += precio * Number(det.alto) * Number(det.ancho) / 10000;
        }
        console.log('[LOG] Resultado final empresa', empresa.nombre, 'puedeCotizar:', puedeCotizar, 'monto:', montoTotal);
        ofertasArr.push({
          empresaId: empresa.id,
          nombre: empresa.nombre,
          monto: puedeCotizar ? Math.round(montoTotal) : null,
          puedeCotizar
        });
      }
      setOfertas(ofertasArr);
      setLoading(false);
    };
    if (cotizacionId && detalles?.length) fetchOfertas();
  }, [cotizacionId, detalles]);

  if (loading) return <div>Cargando ofertas...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h3>Ofertas de empresas de publicidad gráfica</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Precio estimado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {ofertas.map(oferta => (
            <tr key={oferta.empresaId} style={!oferta.puedeCotizar ? { opacity: 0.5, background: '#f8d7da' } : {}}>
              <td>{oferta.nombre}</td>
              <td>{oferta.puedeCotizar ? `$${oferta.monto}` : <span style={{ color: 'red' }}>No disponible</span>}</td>
              <td>
                <button
                  onClick={() => setVisualizar(oferta.empresaId)}
                  disabled={!oferta.puedeCotizar}
                >Visualizar cotización</button>
                <button
                  onClick={() => onAceptar(oferta.empresaId)}
                  style={{ marginLeft: 8 }}
                  disabled={!oferta.puedeCotizar}
                >Aceptar</button>
                <button
                  onClick={() => onRechazar(oferta.empresaId)}
                  style={{ marginLeft: 8 }}
                  disabled={!oferta.puedeCotizar}
                >Rechazar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visualizar && (
        <div style={{ marginTop: 16, border: '1px solid #ccc', padding: 12 }}>
          <h4>Detalle de cotización para empresa seleccionada</h4>
          <ul>
            {detalles.map((det, idx) => (
              <li key={idx}>
                Producto: {det.producto_id}, Alto: {det.alto}cm, Ancho: {det.ancho}cm
              </li>
            ))}
          </ul>
          <button onClick={() => setVisualizar(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
