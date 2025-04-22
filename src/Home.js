import React from 'react';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <h1>Bienvenido a Cotizaciones Automáticas</h1>
      <p>
        Cotiza productos de publicidad gráfica en el exterior de forma rápida y sencilla.<br/>
        Selecciona el producto que necesitas y recibe cotizaciones de múltiples empresas automáticamente.
      </p>
      <div className="home-actions">
        {/* Aquí irán botones de registro/login más adelante */}
      </div>
    </div>
  );
}

export default Home;
