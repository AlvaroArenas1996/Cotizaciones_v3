-- Function to get or create a company record for a profile
create or replace function public.get_or_create_empresa(
  p_profile_id uuid,
  p_nombre text default 'Nueva Empresa',
  p_rut text default '',
  p_direccion text default '',
  p_tipo_empresa text default 'publicidad'
)
returns empresas
language plpgsql
security definer
as $$
declare
  v_empresa empresas%rowtype;
  v_profile_role text;
begin
  -- First check if profile has the right role
  select role into v_profile_role
  from public.profiles
  where id = p_profile_id;
  
  if v_profile_role is null then
    raise exception 'Perfil no encontrado';
  end if;
  
  if v_profile_role != 'empresa' then
    raise exception 'El perfil no tiene el rol de empresa';
  end if;
  
  -- Try to get existing company
  select * into v_empresa
  from public.empresas
  where id = p_profile_id;
  
  -- If company doesn't exist, create it
  if not found then
    insert into public.empresas (
      id,
      nombre,
      rut,
      direccion,
      tipo_empresa
    ) values (
      p_profile_id,
      p_nombre,
      p_rut,
      p_direccion,
      p_tipo_empresa
    )
    returning * into v_empresa;
    
    if v_empresa is null then
      raise exception 'No se pudo crear el registro de la empresa';
    end if;
  end if;
  
  return v_empresa;
exception
  when others then
    raise exception 'Error en get_or_create_empresa: %', sqlerrm;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_or_create_empresa(uuid, text, text, text, text) to authenticated;
