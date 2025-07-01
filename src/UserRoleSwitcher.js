import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { updateUserRole } from './ProfileService';
import EmpresaForm from './EmpresaForm';
import EmpresaProfile from './EmpresaProfile';

// Componente para mostrar un plan de suscripción
const PlanCard = ({ plan, isSelected, onSelect, loading }) => {
  const features = plan.features?.features || [];
  const priceMonthly = parseFloat(plan.price_monthly || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
  
  return (
    <div 
      onClick={() => !loading && onSelect(plan)}
      style={{
        border: `2px solid ${isSelected ? '#4CAF50' : '#e0e0e0'}`,
        borderRadius: '10px',
        padding: '20px',
        margin: '10px',
        backgroundColor: isSelected ? '#f8f9fa' : 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1
      }}
    >
      <h3 style={{
        marginTop: 0,
        color: isSelected ? '#4CAF50' : '#333',
        textAlign: 'center'
      }}>
        {plan.name}
      </h3>
      
      <div style={{ textAlign: 'center', margin: '15px 0' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {priceMonthly}
        </span>
        <span style={{ color: '#666', marginLeft: '5px' }}>/mes</span>
      </div>
      
      <p style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
        {plan.description}
      </p>
      
      <ul style={{ padding: 0, listStyle: 'none', margin: '20px 0' }}>
        {features.map((feature, i) => (
          <li key={i} style={{ padding: '5px 0', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#4CAF50', marginRight: '8px' }}>✓</span>
            {feature}
          </li>
        ))}
      </ul>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onSelect(plan);
        }}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: isSelected ? '#4CAF50' : '#f5f5f5',
          color: isSelected ? 'white' : '#333',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Procesando...' : isSelected ? 'Seleccionado' : 'Seleccionar'}
      </button>
    </div>
  );
};

function UserRoleSwitcher({ onRoleChange }) {
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [showEmpresaForm, setShowEmpresaForm] = useState(false);
  const [tipoEmpresa, setTipoEmpresa] = useState('');
  const [previousRoles, setPreviousRoles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' o 'yearly'
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyData, setCompanyData] = useState({
    companyName: '',
    rut: '',
    address: '',
    phone: '',
    website: '',
    description: ''
  });

  useEffect(() => {
    // Obtener el perfil del usuario actual
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('role, previous_roles')
          .eq('id', session.user.id)
          .single();
        if (!error && data) {
          setRole(data.role);
          setPreviousRoles(data.previous_roles || []);
        }
      }
    };

    // Cargar planes de suscripción
    const fetchSubscriptionPlans = async () => {
      try {
        const { data: plans, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });
        
        if (!error && plans) {
          setPlans(plans);
          if (plans.length > 0) {
            setSelectedPlan(plans[0]);
          }
        }
      } catch (error) {
        console.error('Error al cargar los planes:', error);
        setMessage('Error al cargar los planes de suscripción');
      }
    };

    fetchProfile();
    fetchSubscriptionPlans();
  }, []);

  const handleChangeRole = async (plan) => {
    if (role === 'empresa') {
      setMessage('Ya eres una empresa de publicidad gráfica');
      return;
    }
    
    try {
      setLoading(true);
      setSelectedPlan(plan);
      setMessage('Procesando tu pago...');
      
      // Simular el proceso de pago (reemplazar con la integración real de pago)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Si el pago es exitoso, mostrar el formulario de empresa
      setShowCompanyForm(true);
      setMessage('Pago exitoso. Ahora completa los datos de tu empresa.');
      
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      setMessage('Error al procesar el pago. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      setMessage('No se encontró información del plan seleccionado');
      return;
    }
    
    // Validar campos requeridos
    if (!companyData.companyName || !companyData.phone) {
      setMessage('Por favor completa los campos requeridos (nombre de la empresa y teléfono)');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('Guardando los datos de tu empresa...');
      
      // Preparar los datos para guardar
      const updateData = {
        role: 'empresa',
        display_name: companyData.companyName,  // Usamos display_name que es el nombre correcto
        phone: companyData.phone
        // Nota: No incluimos updated_at ya que no existe en la base de datos
      };
      
      // Solo guardar campos esenciales por ahora
      // Comentamos los campos opcionales para depuración
      // if (companyData.website) updateData.website = companyData.website;
      // if (companyData.rut) updateData.rut = companyData.rut;
      // if (companyData.address) updateData.direccion = companyData.address;
      
      console.log('Guardando en la base de datos:', updateData);
      
      // Guardar en Supabase
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (error) throw error;
      
      // Actualizar el estado local
      setRole('empresa');
      setShowCompanyForm(false);
      setMessage('¡Datos guardados exitosamente!');
      
      // Notificar al componente padre
      if (onRoleChange) onRoleChange('empresa');
      
    } catch (error) {
      console.error('Error al guardar los datos:', error);
      setMessage('Error al guardar los datos. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompanyInputChange = (e) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
  };
  
  const toggleBillingCycle = () => {
    setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly');
  };

  const handleRoleChange = async (nuevoRol) => {
    setMessage('');
    if (role === nuevoRol) {
      setMessage('Ya tienes este rol asignado.');
      return;
    }
    // Solo permitir un rol a la vez
    if (["empresa", "insumos", "cliente"].includes(role) && role !== nuevoRol) {
      if (!window.confirm('Solo puedes tener un tipo de usuario. ¿Deseas cambiar tu tipo de usuario a ' + nuevoRol + '?')) {
        return;
      }
    }
    const { data: { session } } = await supabase.auth.getSession();
    // Guarda el rol anterior en previous_roles (array)
    const updatedPreviousRoles = Array.isArray(previousRoles)
      ? [...previousRoles, { role, changed_at: new Date().toISOString() }]
      : [{ role, changed_at: new Date().toISOString() }];
    const { error } = await supabase
      .from('profiles')
      .update({ role: nuevoRol, previous_roles: updatedPreviousRoles })
      .eq('id', session.user.id);
    if (error) {
      setMessage('Error al cambiar el rol');
    } else {
      setRole(nuevoRol);
      setPreviousRoles(updatedPreviousRoles);
      setMessage('Rol actualizado correctamente.');
      if (onRoleChange) onRoleChange(nuevoRol); // Notifica al padre el cambio
    }
  };

  const handleEmpresaSuccess = async () => {
    setShowEmpresaForm(false);
    setLoading(true);
    setMessage('');
    const newRole = tipoEmpresa === 'publicidad' ? 'empresa' : 'insumos';
    await handleRoleChange(newRole);
    setLoading(false);
  };

  return (
    <div>
      <h3>Tipo de usuario actual: <b>{role === 'empresa' ? 'Empresa de Publicidad' : 'Cliente'}</b></h3>
      
      {role !== 'empresa' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
            Elige el plan que mejor se adapte a tus necesidades
          </h2>
          
          {/* Selector de período de facturación */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '15px'
          }}>
            <span style={{ 
              color: billingCycle === 'monthly' ? '#4CAF50' : '#666',
              fontWeight: billingCycle === 'monthly' ? 'bold' : 'normal'
            }}>Mensual</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={billingCycle === 'yearly'}
                onChange={toggleBillingCycle}
              />
              <span className="slider round"></span>
            </label>
            <span style={{ 
              color: billingCycle === 'yearly' ? '#4CAF50' : '#666',
              fontWeight: billingCycle === 'yearly' ? 'bold' : 'normal'
            }}>Anual (Ahorra 20%)</span>
          </div>

          {/* Lista de planes */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '40px'
          }}>
            {plans.map(plan => (
              <PlanCard 
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan?.id === plan.id}
                onSelect={handleChangeRole}
                loading={loading}
              />
            ))}
          </div>
          
          {message && (
            <div style={{
              backgroundColor: message.includes('error') ? '#ffebee' : '#e8f5e9',
              color: message.includes('error') ? '#c62828' : '#2e7d32',
              padding: '15px',
              borderRadius: '8px',
              margin: '20px 0',
              textAlign: 'center',
              maxWidth: '800px',
              margin: '0 auto 30px'
            }}>
              {message}
            </div>
          )}
          
          <p style={{ 
            textAlign: 'center', 
            color: '#666',
            fontSize: '14px',
            marginTop: '20px'
          }}>
            Sin costos ocultos. Cancela en cualquier momento.
          </p>
        </div>
      )}
      
      {role === 'empresa' && (
        <div style={{
          backgroundColor: '#e8f5e9',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          border: '1px solid #c8e6c9',
          maxWidth: '500px',
          margin: '0 auto 30px'
        }}>
          <h4 style={{ marginTop: 0, color: '#2e7d32' }}>¡Ya eres una Empresa de Publicidad Gráfica!</h4>
          <p style={{ marginBottom: 0 }}>Ahora puedes gestionar tus productos y promociones en el panel de control.</p>
        </div>
      )}
      
      {showEmpresaForm && (
        <EmpresaForm 
          userId={userId} 
          tipoEmpresa={tipoEmpresa} 
          onSuccess={handleEmpresaSuccess} 
        />
      )}
      
      {/* Mostrar datos de empresa si el usuario es empresa */}
      {role === 'empresa' && !showEmpresaForm && (
        <EmpresaProfile 
          userId={userId} 
          tipoEmpresa="publicidad"
        />
      )}
      
      {previousRoles.length > 0 && (
        <div style={{ 
          marginTop: '30px', 
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Historial de roles:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {previousRoles.map((r, idx) => (
              <li key={idx} style={{ marginBottom: '5px' }}>
                {r.role} - {new Date(r.changed_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Modal de formulario de empresa */}
      {showCompanyForm && selectedPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{
              marginTop: 0,
              color: '#333',
              borderBottom: '1px solid #eee',
              paddingBottom: '15px',
              marginBottom: '20px'
            }}>
              Completa los datos de tu empresa
            </h2>
            
            <div style={{
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '25px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '5px' }}>¡Pago exitoso!</div>
                <div style={{ fontSize: '14px' }}>Tu plan <strong>{selectedPlan.name}</strong> ha sido activado. Ahora completa los datos de tu empresa.</div>
              </div>
            </div>
            
            <form onSubmit={handleCompanySubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={companyData.companyName}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ej: Imprenta Creativa S.A."
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  RUT de la Empresa *
                </label>
                <input
                  type="text"
                  name="rut"
                  value={companyData.rut}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ej: 12.345.678-9"
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  Dirección *
                </label>
                <input
                  type="text"
                  name="address"
                  value={companyData.address}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Dirección completa"
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  Teléfono de Contacto *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={companyData.phone}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="+56 9 1234 5678"
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  Sitio Web (opcional)
                </label>
                <input
                  type="url"
                  name="website"
                  value={companyData.website}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="https://www.tuempresa.cl"
                />
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#444'
                }}>
                  Descripción de la Empresa (opcional)
                </label>
                <textarea
                  name="description"
                  value={companyData.description}
                  onChange={handleCompanyInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    minHeight: '100px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Cuéntanos sobre tu empresa, qué servicios ofreces, etc."
                />
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '30px',
                paddingTop: '20px',
                borderTop: '1px solid #eee'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCompanyForm(false)}
                  disabled={loading}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#f5f5f5',
                    color: '#555',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '12px 30px',
                    backgroundColor: loading ? '#81c784' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#43a047')}
                  onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#4CAF50')}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <span>Guardar Datos de la Empresa</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {message && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: message.includes('Error') ? '#ffebee' : '#e8f5e9',
          color: message.includes('Error') ? '#c62828' : '#2e7d32',
          borderRadius: '4px',
          borderLeft: `4px solid ${message.includes('Error') ? '#f44336' : '#4caf50'}`,
          maxWidth: '500px',
          margin: '20px auto 0'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default UserRoleSwitcher;
