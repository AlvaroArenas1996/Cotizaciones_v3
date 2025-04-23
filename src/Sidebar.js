import React from 'react';
import './Sidebar.css';

const baseMenuItems = [
  { icon: '🏠', label: 'Inicio' },
  { icon: '📄', label: 'Portal de cotizaciones' },
];

const empresaMenu = { icon: '🛠️', label: 'Gestión de productos', role: 'empresa' };
const insumosMenu = { icon: '📦', label: 'Gestión de insumos', role: 'insumos' };
const configMenu = { icon: '⚙️', label: 'Configuración' };

export default function Sidebar({ setView, role }) {
  let menuItems = [...baseMenuItems];
  if (role === 'empresa') menuItems.push(empresaMenu);
  if (role === 'insumos') menuItems.push(insumosMenu);
  // Configuración siempre al final
  menuItems.push(configMenu);

  return (
    <div className="sidebar" style={{ width: 220, transition: 'width 0.2s' }}>
      {/* Logo del emprendimiento arriba */}
      <div className="sidebar-brand" style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', letterSpacing: 1, padding: '1rem 1.5rem 0.5rem 1.5rem' }}>
        NOMBRE EMPRENDIMIENTO
      </div>
      <div className="sidebar-header">
        <div className="sidebar-avatar">C4</div>
        {/* Botón de colapso eliminado */}
      </div>
      <ul className="sidebar-menu">
        {menuItems.map(item => (
          <li key={item.label} className="sidebar-menu-item" onClick={() => setView(item.label)}>
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
