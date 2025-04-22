import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { updateUserRole } from './ProfileService';
import EmpresaForm from './EmpresaForm';
import EmpresaProfile from './EmpresaProfile';

function UserRoleSwitcher({ onRoleChange }) {
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [showEmpresaForm, setShowEmpresaForm] = useState(false);
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [previousRoles, setPreviousRoles] = useState([]);

  useEffect(() => {
    // Obtener el perfil del usuario actual
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('role, previous_roles')
          .eq('id', session.user.id)
          .single();
        if (!error && data) {
          setRole(data.role);
          setPreviousRoles(data.previous_roles || []);
        }
      }
    };
    fetchProfile();
  }, []);

  const handleChangeRole = async (newRole) => {
    if (["empresa", "insumos", "cliente"].includes(role) && role !== newRole) {
      if (!window.confirm('Solo puedes tener un tipo de usuario. ¿Deseas cambiar tu tipo de usuario a ' + newRole + '?')) {
        return;
      }
    }
    setTipoEmpresa(newRole === 'empresa' ? 'publicidad' : 'insumos');
    setShowEmpresaForm(true);
  };

  const handleRoleChange = async (nuevoRol) => {
    setMessage('');
    if (role === nuevoRol) {
      setMessage('Ya tienes este rol asignado.');
      return;
    }
    // Solo permitir un rol a la vez
    if (["empresa", "insumos", "cliente"].includes(role) && role !== nuevoRol) {
      if (!window.confirm('Solo puedes tener un tipo de usuario. ¿Deseas cambiar tu tipo de usuario a ' + nuevoRol + '?')) {
        return;
      }
    }
    const { data: { session } } = await supabase.auth.getSession();
    // Guarda el rol anterior en previous_roles (array)
    const updatedPreviousRoles = Array.isArray(previousRoles)
      ? [...previousRoles, { role, changed_at: new Date().toISOString() }]
      : [{ role, changed_at: new Date().toISOString() }];
    const { error } = await supabase
      .from('profiles')
      .update({ role: nuevoRol, previous_roles: updatedPreviousRoles })
      .eq('id', session.user.id);
    if (error) {
      setMessage('Error al cambiar el rol');
    } else {
      setRole(nuevoRol);
      setPreviousRoles(updatedPreviousRoles);
      setMessage('Rol actualizado correctamente.');
      if (onRoleChange) onRoleChange(nuevoRol); // Notifica al padre el cambio
    }
  };

  const handleEmpresaSuccess = async () => {
    setShowEmpresaForm(false);
    setLoading(true);
    setMessage('');
    const newRole = tipoEmpresa === 'publicidad' ? 'empresa' : 'insumos';
    await handleRoleChange(newRole);
    setLoading(false);
  };

  return (
    <div>
      <h3>Tipo de usuario actual: <b>{role}</b></h3>
      <button onClick={() => handleChangeRole('empresa')} disabled={loading || role === 'empresa'}>
        Convertirse en Empresa de Publicidad Gráfica
      </button>
      <button onClick={() => handleChangeRole('insumos')} disabled={loading || role === 'insumos'}>
        Convertirse en Empresa de Insumos
      </button>
      <button onClick={() => handleChangeRole('cliente')} disabled={loading || role === 'cliente'}>
        Convertirse en Cliente
      </button>
      {showEmpresaForm && (
        <EmpresaForm userId={userId} tipoEmpresa={tipoEmpresa} onSuccess={handleEmpresaSuccess} />
      )}
      {/* Mostrar datos de empresa si el usuario es empresa o insumos */}
      {(role === 'empresa' || role === 'insumos') && !showEmpresaForm && (
        <EmpresaProfile userId={userId} tipoEmpresa={role === 'empresa' ? 'publicidad' : 'insumos'} />
      )}
      {previousRoles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <b>Historial de roles anteriores:</b>
          <ul>
            {previousRoles.map((r, idx) => (
              <li key={idx}>{r.role} (cambiado el {r.changed_at ? new Date(r.changed_at).toLocaleString() : ''})</li>
            ))}
          </ul>
        </div>
      )}
      {message && <div style={{ marginTop: 10 }}>{message}</div>}
    </div>
  );
}

export default UserRoleSwitcher;
