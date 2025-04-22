# Plataforma

## Estructura del Proyecto

```
Plataforma/
├── backend/         # Node.js + Express (API, conexión Supabase)
│   ├── index.js
│   ├── .env
│   └── package.json
├── frontend/        # React (interfaz de usuario)
├── supabase/        # Configuración de Supabase CLI
└── README.md
```

## Primeros pasos

### Backend
1. Ve a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Copia tus claves de Supabase en el archivo `.env`.
3. Inicia el servidor:
   ```bash
   node index.js
   ```

### Frontend
1. Ve a la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Inicia la app React:
   ```bash
   npm start
   ```

### Supabase CLI
- Usa la carpeta `supabase/` para gestionar migraciones y configuraciones locales.

---

## Recomendación
Esta estructura es muy recomendable: separa el frontend (React) del backend (Node.js/Express), facilitando el desarrollo y despliegue independiente de cada parte.

- **Frontend**: Interfaz de usuario moderna, fácil de mantener.
- **Backend**: API RESTful, lógica de negocio, conexión segura a Supabase.
- **Supabase**: Backend-as-a-Service (BaaS) para autenticación, base de datos y almacenamiento.

¡Listo para escalar y trabajar en equipo!
