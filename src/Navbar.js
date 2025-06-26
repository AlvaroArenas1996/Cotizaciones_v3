import React, { useEffect, useState } from 'react';
import './Navbar.css';
import { supabase } from './supabaseClient';

const navItems = [
  { label: 'Conoce los productos y/o servicios' },
  { label: 'Antes de comprar' },
  { label: 'Blog' },
];

export default function Navbar({ onNavigate }) {
  // Estado inicial de la empresa: 'Inactivo' por defecto para cuentas nuevas
  const [estadoEmpresa, setEstadoEmpresa] = useState('Inactivo');
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [userRole, setUserRole] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [userId, setUserId] = useState('');
  const empresaId = localStorage.getItem('empresa_id'); // ID de la empresa del usuario actual

  useEffect(() => {
    const fetchUserData = async () => {
      setLoadingEstado(true);
      try {
        // Obtener el usuario actual
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error al obtener usuario:', userError);
          setLoadingEstado(false);
          return;
        }
        
        setUserId(user.id);
        
        // Obtener el perfil del usuario actual
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (profileError) {
          console.error('Error al obtener perfil:', profileError);
          setEstadoEmpresa('No registrado');
          setLoadingEstado(false);
          return;
        }
        
        // Establecer el rol del usuario desde el perfil
        const userRoleFromProfile = profile.role || '';
        setUserRole(userRoleFromProfile);
        
        // Si el usuario es empresa, establecer los datos correspondientes
        if (userRoleFromProfile === 'empresa') {
          // Registrar el perfil completo para depuración
          console.log('[Navbar] Perfil de empresa cargado:', {
            id: profile.id,
            estado_empresa: profile.estado_empresa,
            tipo_empresa: profile.tipo_empresa,
            nombre_empresa: profile.nombre_empresa,
            role: profile.role
          });
          
          // Forzar estado 'Inactivo' para todas las empresas al cargar
          // Esto asegura que aunque en la BD esté como 'Activo', en el frontend se muestre como 'Inactivo'
          console.log(`[Navbar] Forzando estado de empresa a: Inactivo (anterior: ${profile.estado_empresa || 'no definido'})`);
          
          // Actualizar el estado en la base de datos si es necesario
          if (profile.estado_empresa !== 'Inactivo') {
            console.log('[Navbar] Actualizando estado en BD a: Inactivo');
            await supabase
              .from('profiles')
              .update({ estado_empresa: 'Inactivo' })
              .eq('id', profile.id);
          }
          
          setEstadoEmpresa('Inactivo');
          setTipoEmpresa(profile.tipo_empresa || 'publicidad');
          setEmpresaNombre(profile.nombre_empresa || '');
        } else {
          // Si no es empresa, limpiar los estados
          setEstadoEmpresa('');
          setTipoEmpresa('');
          setEmpresaNombre('');
        }
      } catch (err) {
        console.error('Error al cargar datos del perfil:', err);
        setEstadoEmpresa('Error');
      } finally {
        setLoadingEstado(false);
      }
    };
    
    fetchUserData();
  }, []);

  // Este efecto ya no es necesario ya que ahora obtenemos todo en el primer efecto

  const toggleEstadoEmpresaNavbar = async () => {
    if (!userId) {
      console.error('No hay ID de usuario disponible');
      return;
    }
    
    try {
      setLoadingEstado(true);
      const nuevoEstado = estadoEmpresa === 'Activo' ? 'Inactivo' : 'Activo';
      
      // Actualizar el estado local inmediatamente para una respuesta más rápida
      setEstadoEmpresa(nuevoEstado);
      
      // Actualizar en la base de datos
      const { error } = await supabase
        .from('profiles')
        .update({ 
          estado_empresa: nuevoEstado,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (error) {
        // Revertir el cambio si hay un error
        setEstadoEmpresa(estadoEmpresa);
        console.error('Error al actualizar el estado:', error);
        alert('Error al actualizar el estado: ' + error.message);
        return;
      }
      
      console.log(`Estado actualizado a: ${nuevoEstado}`);
      // No es necesario actualizar el estado de nuevo, ya lo hicimos al principio
      
    } catch (e) {
      // Revertir el cambio en caso de error
      setEstadoEmpresa(estadoEmpresa);
      console.error('Error inesperado al actualizar estado:', e);
      alert('Error inesperado al actualizar estado: ' + (e.message || e));
    } finally {
      setLoadingEstado(false);
    }
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
          {(() => {
            // Verificar que el usuario esté autenticado, sea empresa y tenga el tipo correcto
            const esEmpresa = userRole === 'empresa';
            const tieneTipoPublicidad = tipoEmpresa && tipoEmpresa.toLowerCase().includes('publicidad');
            const mostrarBoton = esEmpresa && tieneTipoPublicidad;
            
            if (mostrarBoton) {
              return (
                <button
                  id="estado-empresa-navbar"
                  style={{
                    padding: '8px 18px',
                    background: estadoEmpresa === 'Activo' ? '#e11d48' : '#059669',
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
                    : estadoEmpresa === 'Activo'
                      ? 'Desactivar Venta'
                      : 'Activar Venta'}
                </button>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </nav>
  );
}
