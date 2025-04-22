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
        .from('empresas')
        .select('id, nombre')
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
        for (const det of detalles) {
          // Lógica personalizada por empresa (igual que en ResponderCotizaciones.js)
          let precio = 0;
          // 1. Buscar precio personalizado
          const { data: precioPersonalizado } = await supabase
            .from('precios_actualizados')
            .select('valor_actualizado')
            .eq('id_empresa', empresa.id)
            .eq('id_producto', det.producto_id)
            .single();
          if (precioPersonalizado) {
            precio = Number(precioPersonalizado.valor_actualizado);
          } else {
            // 2. Tomar precio base
            const { data: prod } = await supabase
              .from('productos')
              .select('precio')
              .eq('id_producto', det.producto_id)
              .single();
            precio = prod ? Number(prod.precio) : 0;
          }
          montoTotal += precio * Number(det.alto) * Number(det.ancho) / 10000; // ejemplo: precio por m2
        }
        ofertasArr.push({
          empresaId: empresa.id,
          nombre: empresa.nombre,
          monto: Math.round(montoTotal),
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
            <tr key={oferta.empresaId}>
              <td>{oferta.nombre}</td>
              <td>${oferta.monto}</td>
              <td>
                <button onClick={() => setVisualizar(oferta.empresaId)}>Visualizar cotización</button>
                <button onClick={() => onAceptar(oferta.empresaId)} style={{ marginLeft: 8 }}>Aceptar</button>
                <button onClick={() => onRechazar(oferta.empresaId)} style={{ marginLeft: 8 }}>Rechazar</button>
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
