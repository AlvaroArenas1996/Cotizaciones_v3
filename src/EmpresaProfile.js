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
      if (!userId) return;
      
      try {
        setLoading(true);
        
        // Obtener datos del perfil
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (profileError) throw profileError;
        
        if (profileData) {
          console.log('Datos de perfil cargados:', profileData);
          
          // Usar display_name como nombre de la empresa si está disponible
          const nombreEmpresa = profileData.display_name || '';
          
          // Mapear los campos del perfil al formato de empresa
          setEmpresa({
            id: profileData.id,
            nombre: nombreEmpresa,
            rut: profileData.rut || '',
            direccion: profileData.direccion || '',
            tipo_empresa: profileData.tipo_empresa || 'publicidad'
          });
          
          // Actualizar los estados del formulario
          setNombre(nombreEmpresa);
          setRut(profileData.rut || '');
          setDireccion(profileData.direccion || '');
        }
        
      } catch (error) {
        console.error('Error al cargar datos del perfil:', error);
        setError('Error al cargar los datos del perfil');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmpresa();
  }, [userId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!userId) {
      setError('No se ha identificado al usuario');
      return;
    }
    
    try {
      // 1. Obtener el estado actual de la empresa
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('estado_empresa')
        .eq('id', userId)
        .single();
      
      // 2. Preparar los datos del perfil, manteniendo el estado actual o usando 'Inactivo' por defecto
      const perfilData = {
        display_name: nombre ? nombre.toString().trim() : '',
        rut: rut ? rut.toString().trim() : null,
        direccion: direccion ? direccion.toString().trim() : null,
        tipo_empresa: (tipoEmpresa || 'publicidad').toString(),
        estado_empresa: currentProfile?.estado_empresa || 'Inactivo', // Mantener estado existente o usar 'Inactivo'
        role: 'empresa',
        updated_at: new Date().toISOString()
      };
      
      console.log('Datos a guardar en profiles:', perfilData);
      
      // 2. Actualizar el perfil con los datos de la empresa
      const { data, error } = await supabase
        .from('profiles')
        .update(perfilData)
        .eq('id', userId)
        .select('*');
      
      if (error) {
        console.error('Error al actualizar perfil:', error);
        throw error;
      }
      
      console.log('Perfil actualizado correctamente:', data);
      
      // 3. Actualizar el estado local con la respuesta del servidor
      const updatedProfile = data[0];
      setEmpresa({
        id: userId,
        nombre: updatedProfile.display_name || '',
        rut: updatedProfile.rut || '',
        direccion: updatedProfile.direccion || '',
        tipo_empresa: updatedProfile.tipo_empresa || 'publicidad'
      });
      
      setEditMode(false);
      setSuccess('Datos de la empresa guardados correctamente');
      
      // Recargar para asegurar sincronización
      setTimeout(() => window.location.reload(), 1000);
      
      
    } catch (error) {
      console.error('Error al guardar datos de la empresa:', error);
      setError(`Error al guardar: ${error.message}`);
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
