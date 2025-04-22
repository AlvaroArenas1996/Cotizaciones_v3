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
    const { error } = await supabase.from('empresas').upsert([
      {
        id: userId,
        nombre,
        rut,
        direccion,
        tipo_empresa: tipoEmpresa,
      },
    ]);
    setLoading(false);
    if (error) setError('Error al guardar datos de empresa');
    else onSuccess();
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
