import React, { useEffect, useState } from 'react';
import './Navbar.css';
import { supabase } from './supabaseClient';

const navItems = [
  { label: 'Conoce los productos y/o servicios' },
  { label: 'Antes de comprar' },
  { label: 'Blog' },
];

export default function Navbar({ onNavigate }) {
  const [estadoEmpresa, setEstadoEmpresa] = useState('');
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [userRole, setUserRole] = useState('');
  const empresaId = localStorage.getItem('empresa_id'); // Ajusta si tu app usa otro método

  useEffect(() => {
    const fetchEstado = async () => {
      if (!empresaId) {
        console.log('No empresaId en localStorage');
        return;
      }
      setLoadingEstado(true);
      const { data, error } = await supabase.from('empresas').select('estado').eq('id', empresaId).single();
      console.log('fetchEstado supabase:', { data, error, empresaId });
      if (!error && data) setEstadoEmpresa(data.estado);
      setLoadingEstado(false);
    };
    fetchEstado();
  }, [empresaId]);

  useEffect(() => {
    const fetchTipoEmpresaYRol = async () => {
      // Obtener sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      // Obtener rol
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role) setUserRole(profile.role);
      // Obtener tipo_empresa solo si hay empresa_id
      if (empresaId) {
        const { data, error } = await supabase.from('empresas').select('tipo_empresa').eq('id', empresaId).single();
        if (!error && data) setTipoEmpresa(data.tipo_empresa);
      } else {
        setTipoEmpresa('');
      }
    };
    fetchTipoEmpresaYRol();
  }, [empresaId]);

  const toggleEstadoEmpresaNavbar = async () => {
    if (!empresaId) {
      console.log('No empresaId en localStorage');
      return;
    }
    setLoadingEstado(true);
    const nuevoEstado = estadoEmpresa === 'Habilitada para vender' ? 'Deshabilitada para vender' : 'Habilitada para vender';
    console.log('Intentando actualizar estado en Supabase:', { empresaId, nuevoEstado });
    try {
      // Alternativa: usa .single() y revisa count
      const { error, data, count } = await supabase
        .from('empresas')
        .update({ estado: nuevoEstado })
        .eq('id', empresaId)
        .select('*', { count: 'exact' })
        .single();
      console.log('[toggleEstadoEmpresaNavbar][ALTERNATIVA] update supabase:', { error, data, count });
      if (error) {
        alert('Error actualizando estado en Supabase: ' + error.message);
        console.error('[toggleEstadoEmpresaNavbar][ALTERNATIVA] ERROR SUPABASE:', error, error.message, error.details, error.hint);
      } else if (!data) {
        alert('No se encontró la empresa para actualizar (data vacío).');
        console.warn('[toggleEstadoEmpresaNavbar][ALTERNATIVA] No rows updated.');
      } else {
        setEstadoEmpresa(nuevoEstado);
        console.log('[toggleEstadoEmpresaNavbar][ALTERNATIVA] Estado actualizado correctamente:', nuevoEstado, 'data:', data, 'count:', count);
      }
    } catch (e) {
      alert('Excepción inesperada al actualizar estado: ' + (e.message || e));
      console.error('[toggleEstadoEmpresaNavbar][ALTERNATIVA] EXCEPCION:', e);
    }
    setLoadingEstado(false);
  };

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
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 16 }}>
          {/* SOLO empresas de publicidad gráfica ven el botón, nunca clientes */}
          {userRole === 'empresa' && tipoEmpresa && tipoEmpresa.toLowerCase().includes('publicidad') && (
            <button
              id="estado-empresa-navbar"
              style={{
                padding: '8px 18px',
                background: estadoEmpresa === 'Habilitada para vender' ? '#059669' : '#e11d48',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
                cursor: loadingEstado ? 'not-allowed' : 'pointer',
                marginRight: 12,
                minWidth: 190,
                transition: 'background 0.2s',
                opacity: loadingEstado ? 0.7 : 1
              }}
              onClick={toggleEstadoEmpresaNavbar}
              disabled={loadingEstado}
            >
              {loadingEstado
                ? 'Actualizando...'
                : estadoEmpresa === 'Habilitada para vender'
                  ? 'Habilitada para vender'
                  : 'Deshabilitada para vender'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
