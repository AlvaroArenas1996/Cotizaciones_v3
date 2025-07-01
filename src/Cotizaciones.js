import React, { useState } from 'react';
import CotizarProducto from './CotizarProducto';
import HistorialCotizaciones from './HistorialCotizaciones';
import './Cotizaciones.css';

export default function Cotizaciones({ setView, setNegociacionActiva }) {
  const [mostrarNueva, setMostrarNueva] = useState(false);

  // Callback para abrir detalle de cotización con datos
  const handleIrANegociacion = (venta, cotizacion, empresa) => {
    setNegociacionActiva({ venta, cotizacion, empresa });
    setView('Detalle de cotizacion');
  };

  return (
    <div className="cotizaciones-container">
      <div className="cotizaciones-header">
        <span className="cotizaciones-title">Cotizaciones</span>
        <button className="nueva-cotizacion-btn" onClick={() => setMostrarNueva(true)}>
          Nueva Cotización
        </button>
      </div>
      {mostrarNueva ? (
        <div className="modal-cotizacion">
          <div className="modal-cotizacion-content" style={{ minWidth: 700, maxWidth: 980, padding: 0, position: 'relative' }}>
            <button
              onClick={() => setMostrarNueva(false)}
              className="modal-cerrar-btn"
              title="Cerrar"
            >
              ×
            </button>
            <CotizarProducto onCotizacionGuardada={() => setMostrarNueva(false)} />
          </div>
        </div>
      ) : (
        <HistorialCotizaciones recargarTrigger={mostrarNueva} setView={setView} setNegociacionActiva={setNegociacionActiva} handleIrANegociacion={handleIrANegociacion} />
      )}
    </div>
  );
}
