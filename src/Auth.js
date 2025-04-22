import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import './Auth.css';
import PhonePrompt from './PhonePrompt';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('[Auth] handleSubmit: Iniciando login con Google');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
      console.error('[Auth] Error en signInWithOAuth:', error);
      setError(error.message);
    }
    setLoading(false);
  };

  async function handleSavePhoneAfterGoogle(phone) {
    console.log('[Auth] Guardando teléfono tras Google:', phone);
    const { data: existing } = await supabase.from('profiles').select('id').eq('phone', phone).single();
    if (existing) {
      setError('Este teléfono ya está registrado.');
      console.error('[Auth] Teléfono ya registrado:', phone);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUid = sessionData?.session?.user?.id;
    console.log('[Auth] googleUser.id:', googleUser?.id);
    console.log('[Auth] auth.uid():', currentUid);
    const { error: upsertError } = await supabase.from('profiles').upsert([{ id: googleUser.id, phone }]);
    if (upsertError) {
      setError(upsertError.message);
      console.error('[Auth] Error al guardar teléfono:', upsertError);
      return;
    }
    await supabase.auth.updateUser({ data: { phone } });
    setNeedPhone(false);
    setGoogleUser(null);
    setError(null);
    console.log('[Auth] Teléfono guardado correctamente, usuario autenticado.');
  }

  if (needPhone && googleUser) {
    return <PhonePrompt onSave={handleSavePhoneAfterGoogle} error={error} />;
  }

  return (
    <div className="auth-container">
      <h2>Iniciar sesión</h2>
      <button className="google-btn" onClick={handleSubmit} disabled={loading}>
        Iniciar sesión con Google
      </button>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}

export default Auth;
