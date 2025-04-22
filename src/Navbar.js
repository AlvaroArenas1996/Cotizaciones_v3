import React from 'react';
import './Navbar.css';

const navItems = [
  { label: 'Conoce los productos y/o servicios' },
  { label: 'Antes de comprar' },
  { label: 'Blog' },
];

export default function Navbar({ onNavigate }) {
  return (
    <nav className="navbar-main">
      <div className="navbar-content">
        {/* Eliminado el logo del emprendimiento */}
        <ul className="navbar-links">
          {navItems.map(item => (
            <li key={item.label} className="navbar-link" onClick={() => onNavigate && onNavigate(item.label)}>
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
