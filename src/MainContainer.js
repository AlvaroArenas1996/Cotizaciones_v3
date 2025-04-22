import React from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import './Navbar.css';

function MainContainer({ children, onLogout }) {
  // children[0]: Sidebar, children[1]: Navbar, children[2+]: contenido
  const sidebar = children[0];
  const isCollapsed = sidebar && sidebar.props && sidebar.props.collapsed;
  const sidebarWidth = isCollapsed ? 60 : 220;

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex' }}>
      {/* Sidebar vertical a la izquierda */}
      <div style={{ zIndex: 1201, width: sidebarWidth, transition: 'width 0.2s', minHeight: '100vh' }}>
        {sidebar}
      </div>
      {/* Contenedor principal: Navbar arriba y contenido debajo */}
      <div style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0',
          background: '#151c2c',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          height: 58,
          zIndex: 1200,
          marginLeft: 0,
          width: '100%',
          transition: 'margin-left 0.2s, width 0.2s'
        }}>
          {children[1]}
          <div style={{ marginLeft: 'auto', padding: '0 2rem' }}>
            <button
              onClick={onLogout}
              style={{ padding: '0.5rem 1rem', borderRadius: 4, border: 'none', background: '#151c2c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        {/* El resto del contenido */}
        <main style={{
          maxWidth: 1100,
          margin: '1.5rem 0 0 0',
          padding: '1.25rem 1.5rem',
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          width: '98%',
          minWidth: 0,
          alignSelf: 'flex-start',
        }}>
          {children.slice(2)}
        </main>
      </div>
    </div>
  );
}

export default MainContainer;
