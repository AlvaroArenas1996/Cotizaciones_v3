import React, { useState } from 'react';

function PhonePrompt({ onSave, error }) {
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone.match(/^\+\d{8,15}$/)) {
      setLocalError('Ingresa un teléfono válido en formato internacional, ej: +56912345678');
      return;
    }
    setLocalError(null);
    onSave(phone);
  };

  return (
    <div className="auth-container">
      <h2>Ingresa tu teléfono</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="tel"
          placeholder="Teléfono (+56912345678)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
        />
        <button type="submit">Guardar teléfono</button>
        {(localError || error) && <div className="auth-error">{localError || error}</div>}
      </form>
    </div>
  );
}

export default PhonePrompt;
