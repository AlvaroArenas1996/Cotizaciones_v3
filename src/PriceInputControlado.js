import React, { useState, useEffect } from 'react';

export default function PriceInputControlado({ initialValue, onSave, disabled, placeholder }) {
  const [valor, setValor] = useState(initialValue ?? '');

  // Sincroniza el valor si initialValue cambia desde fuera
  useEffect(() => {
    setValor(initialValue ?? '');
  }, [initialValue]);

  return (
    <>
      <input
        type="number"
        value={valor}
        min={0}
        onChange={e => setValor(e.target.value)}
        style={{
          width: 110,
          padding: '5px 8px',
          border: '1px solid #cbd5e1',
          borderRadius: 5,
          background: disabled ? '#f1f5f9' : '#f9fafb',
          fontSize: 15,
          marginLeft: 10
        }}
        placeholder={placeholder || 'Sin personalizar'}
        disabled={disabled}
      />
      <button
        onClick={() => onSave(Number(valor))}
        disabled={valor === '' || valor === null || disabled}
        style={{
          background: (valor === '' || valor === null || disabled) ? '#e2e8f0' : '#2563eb',
          color: (valor === '' || valor === null || disabled) ? '#64748b' : '#fff',
          border: 'none',
          borderRadius: 5,
          padding: '6px 16px',
          fontWeight: 600,
          cursor: (valor === '' || valor === null || disabled) ? 'not-allowed' : 'pointer',
          fontSize: 14,
          marginLeft: 12
        }}
      >
        Guardar
      </button>
    </>
  );
}
