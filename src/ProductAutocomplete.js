import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function ProductAutocomplete({ value, nombre, onSelect }) {
  const [query, setQuery] = useState(nombre || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef();

  // Mantén sincronizado el input con el nombre seleccionado desde fuera
  useEffect(() => {
    setQuery(nombre || '');
  }, [nombre]);

  // Buscar productos por nombre (ilike para coincidencia parcial, máx 8 resultados)
  const fetchSuggestions = async (value) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('productos')
      .select('id_producto, nombre_producto')
      .ilike('nombre_producto', `%${value}%`)
      .limit(8);
    if (!error && data) setSuggestions(data);
    else setSuggestions([]);
    setLoading(false);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length > 0) fetchSuggestions(value.trim());
      else setSuggestions([]);
    }, 250);
  };

  const handleSelect = (producto) => {
    if (onSelect) onSelect(producto);
    setQuery(producto.nombre_producto);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Buscar producto por nombre..."
        autoComplete="off"
        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 16, boxSizing: 'border-box', height: 38, minWidth: 0, maxWidth: '100%' }}
        onFocus={() => query && setShowDropdown(true)}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: 38,
          left: 0,
          width: '100%',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          zIndex: 10,
          maxHeight: 180,
          overflowY: 'auto',
          margin: 0,
          padding: 0,
          listStyle: 'none'
        }}>
          {suggestions.map(prod => (
            <li
              key={prod.id_producto}
              style={{ padding: 8, cursor: 'pointer' }}
              onMouseDown={() => handleSelect(prod)}
            >
              {prod.nombre_producto}
            </li>
          ))}
        </ul>
      )}
      {loading && <div style={{ position: 'absolute', top: 38, left: 8, fontSize: 12 }}>Cargando...</div>}
    </div>
  );
}
