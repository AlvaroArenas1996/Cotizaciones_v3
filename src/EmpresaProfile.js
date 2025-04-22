import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function EmpresaProfile({ userId, tipoEmpresa }) {
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchEmpresa = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('empresas').select('*').eq('id', userId).single();
      if (data) {
        setEmpresa(data);
        setNombre(data.nombre);
        setRut(data.rut || '');
        setDireccion(data.direccion || '');
      }
      setLoading(false);
    };
    if (userId) fetchEmpresa();
  }, [userId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const { error } = await supabase.from('empresas').update({ nombre, rut, direccion }).eq('id', userId);
    if (!error) {
      setEmpresa({ ...empresa, nombre, rut, direccion });
      setEditMode(false);
      setSuccess('Datos de empresa actualizados.');
    } else {
      setError('Error al actualizar datos de empresa.');
    }
  };

  if (loading) return <div>Cargando datos de empresa...</div>;
  if (!empresa) return <div>No hay datos de empresa registrados.</div>;

  return (
    <div style={{ marginTop: 30, background: '#f4f4f4', padding: 16, borderRadius: 8 }}>
      <h4>Datos de la empresa ({tipoEmpresa})</h4>
      {editMode ? (
        <form onSubmit={handleUpdate}>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            placeholder="Nombre de la empresa"
          />
          <input
            type="text"
            value={rut}
            onChange={e => setRut(e.target.value)}
            placeholder="RUT (opcional)"
          />
          <input
            type="text"
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Dirección (opcional)"
          />
          <button type="submit">Guardar cambios</button>
          <button type="button" onClick={() => setEditMode(false)}>Cancelar</button>
        </form>
      ) : (
        <div>
          <div><b>Nombre:</b> {empresa.nombre}</div>
          <div><b>RUT:</b> {empresa.rut || '-'}</div>
          <div><b>Dirección:</b> {empresa.direccion || '-'}</div>
          <button onClick={() => setEditMode(true)} style={{ marginTop: 10 }}>Editar datos de empresa</button>
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}
      {success && <div style={{ color: 'green', marginTop: 10 }}>{success}</div>}
    </div>
  );
}

export default EmpresaProfile;
