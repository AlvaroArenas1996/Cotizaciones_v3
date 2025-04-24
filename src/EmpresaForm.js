import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function EmpresaForm({ userId, tipoEmpresa, onSuccess }) {
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('[EmpresaForm] userId:', userId);
    console.log('[EmpresaForm] nombre:', nombre);
    console.log('[EmpresaForm] rut:', rut);
    console.log('[EmpresaForm] direccion:', direccion);
    console.log('[EmpresaForm] tipoEmpresa:', tipoEmpresa);
    const payload = {
      id: userId,
      nombre,
      rut,
      direccion,
      tipo_empresa: tipoEmpresa,
    };
    // Elimina nombre_producto si accidentalmente se incluyera
    delete payload.nombre_producto;
    console.log('[EmpresaForm] payload a insertar:', payload);
    try {
      const { data, error, status, statusText } = await supabase.from('empresas').upsert([
        payload
      ]);
      console.log('[EmpresaForm] respuesta supabase:', { data, error, status, statusText });
      setLoading(false);
      if (error) {
        console.error('[EmpresaForm] ERROR SUPABASE:', error, error.message, error.details, error.hint);
        setError('Error al guardar datos de empresa: ' + error.message + (error.details ? ' Detalles: ' + error.details : ''));
      } else {
        onSuccess();
      }
    } catch (e) {
      setLoading(false);
      console.error('[EmpresaForm] EXCEPCION:', e);
      setError('Excepción inesperada al guardar datos de empresa: ' + (e.message || e));
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      <h4>Datos de la empresa</h4>
      <input
        type="text"
        placeholder="Nombre de la empresa"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="RUT (opcional)"
        value={rut}
        onChange={e => setRut(e.target.value)}
      />
      <input
        type="text"
        placeholder="Dirección (opcional)"
        value={direccion}
        onChange={e => setDireccion(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar datos de empresa'}
      </button>
      {error && <div className="auth-error">{error}</div>}
    </form>
  );
}

export default EmpresaForm;
