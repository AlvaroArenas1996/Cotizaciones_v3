import { supabase } from './supabaseClient';

// Guarda el teléfono y rol en la tabla perfil
export async function saveUserProfile(userId, phone, role = 'cliente') {
  // Asegúrate de tener una columna 'role' en la tabla 'profiles'
  return await supabase.from('profiles').upsert([
    { id: userId, phone, role }
  ]);
}

// Actualiza el rol del usuario (empresa de publicidad gráfica o insumos)
export async function updateUserRole(userId, newRole) {
  return await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
}
