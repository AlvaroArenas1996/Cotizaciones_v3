import logo from './logo.svg';
import './App.css';
import Home from './Home';
import Auth from './Auth';
import { useState, useEffect } from 'react';
import MainContainer from './MainContainer';
import UserRoleSwitcher from './UserRoleSwitcher';
import EditarPreciosPersonalizados from './EditarPreciosPersonalizados';
import Cotizaciones from './Cotizaciones';
import ResponderCotizaciones from './ResponderCotizaciones';
import Sidebar from './Sidebar';
import './Sidebar.css';
import Navbar from './Navbar';
import './Navbar.css';
import { supabase } from './supabaseClient';
import DetalleNegociacion from './DetalleNegociacion';

function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home');
  const [role, setRole] = useState('');
  const [negociacionActiva, setNegociacionActiva] = useState(null); // Para datos de la negociación

  useEffect(() => {
    const getSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user?.id) {
        // Leer el perfil primero
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, email')
          .eq('id', session.user.id)
          .single();
        if (!profileError && profile) {
          setRole(profile.role);
          // Solo crear perfil si no tiene rol
          if (!profile.role) {
            const profilePayload = {
              id: session.user.id,
              email: session.user.email,
              role: 'cliente'
            };
            console.log('[App.js] Upsert SOLO si no tiene rol:', profilePayload);
            const { error: upsertError } = await supabase.from('profiles').upsert([profilePayload]);
            if (upsertError) console.error('[App.js] Error en upsert:', upsertError);
          }
        } else {
          // Si no existe perfil, crearlo
          const profilePayload = {
            id: session.user.id,
            email: session.user.email,
            role: 'cliente'
          };
          console.log('[App.js] Upsert porque no hay perfil:', profilePayload);
          const { error: upsertError } = await supabase.from('profiles').upsert([profilePayload]);
          if (upsertError) console.error('[App.js] Error en upsert:', upsertError);
          setRole('cliente');
        }
      }
    };
    getSessionAndRole();
    // Escuchar cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Evitar actualizar si el usuario no cambió
      setSession(prev => {
        if (prev?.user?.id === session?.user?.id) {
          return prev; // No actualizar el estado si el usuario es el mismo
        }
        return session;
      });
      if (session?.user?.id) {
        supabase
          .from('profiles')
          .select('role, email')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error: profileError }) => {
            if (!profileError && profile) {
              setRole(profile.role);
              if (!profile.role) {
                const profilePayload = {
                  id: session.user.id,
                  email: session.user.email,
                  role: 'cliente'
                };
                console.log('[App.js] Upsert SOLO si no tiene rol:', profilePayload);
                supabase
                  .from('profiles')
                  .upsert([profilePayload])
                  .then(({ error: upsertError }) => {
                    if (upsertError) console.error('[App.js] Error en upsert:', upsertError);
                  });
              }
            } else {
              const profilePayload = {
                id: session.user.id,
                email: session.user.email,
                role: 'cliente'
              };
              console.log('[App.js] Upsert porque no hay perfil:', profilePayload);
              supabase
                .from('profiles')
                .upsert([profilePayload])
                .then(({ error: upsertError }) => {
                  if (upsertError) console.error('[App.js] Error en upsert:', upsertError);
                  setRole('cliente');
                });
            }
          });
      } else {
        setRole('');
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const setEmpresaId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        // Buscar en profiles donde el id coincida con el usuario y el rol sea 'empresa'
        const { data: perfil, error } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
          
        if (perfil && perfil.id && perfil.role === 'empresa') {
          localStorage.setItem('empresa_id', perfil.id);
        }
      }
    };
    setEmpresaId();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRole('');
    setView('home');
  };

  const handleRoleChange = (nuevoRol) => {
    setRole(nuevoRol);
    // Opcional: cambiar la vista si el usuario está en una sección que ya no corresponde
    if (nuevoRol === 'empresa') setView('productos');
    else if (nuevoRol === 'insumos') setView('insumos');
    else setView('home');
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <MainContainer onLogout={handleLogout}>
      {/* Sidebar encima del Navbar */}
      <Sidebar setView={setView} role={role} />
      {/* Navbar debajo del Sidebar, pero dentro del MainContainer */}
      <Navbar onNavigate={setView} />
      <div style={{ marginBottom: 24 }}>
        {/* Solo botones secundarios, sin Gestión de productos ni responder cotizaciones */}
        {role === 'insumos' && (
          <button onClick={() => setView('Gestión de insumos')}>Gestión de insumos</button>
        )}
      </div>
      {view === 'home' || view === 'Inicio' ? <Home /> : null}
      {view === 'Planes' && <UserRoleSwitcher onRoleChange={handleRoleChange} />}
      {/* Portal de cotizaciones contiene todo el flujo de interacción */}
      {view === 'Portal de cotizaciones' && (
        <Cotizaciones setView={setView} setNegociacionActiva={setNegociacionActiva} />
      )}
      {view === 'Detalle de cotizacion' && negociacionActiva && (
        <DetalleNegociacion cotizacionId={negociacionActiva.cotizacion?.id || negociacionActiva.cotizacion_id || negociacionActiva?.id} onVolver={() => setView('Portal de cotizaciones')} usuario={session?.user} />
      )}
      {view === 'Gestión de productos' && role === 'empresa' && (
        <EditarPreciosPersonalizados key={view + '-' + role} tipoEmpresa="empresa" />
      )}
      {view === 'Gestión de insumos' && role === 'insumos' && (
        <EditarPreciosPersonalizados key={view + '-' + role} tipoEmpresa="insumos" />
      )}
      {/* Eliminada la lógica de responder cotizaciones */}
    </MainContainer>
  );
}

export default App;
