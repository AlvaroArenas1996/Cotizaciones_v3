# Estructura y funcionalidades principales

## Esquema de páginas y secciones

### Páginas principales
- **Home (Landing Page):** Presentación del servicio y acceso a registro/login.
- **Registro/Login:** Acceso según tipo de usuario (cliente, empresa, empresa de insumos).
- **Phone Prompt:** Solicitud de número de teléfono para autenticación.
- **Auth:** Autenticación y registro de usuarios.
  - Por defecto, todos los usuarios nuevos son tipo **Cliente** (puede cotizar a empresas de publicidad gráfica).
  - El tipo de usuario se puede cambiar luego en la configuración.
- **Gestión de productos:**
  - Existirá una base de datos general para todas las empresas de publicidad gráfica. esta tabla, contendrá todos los productos vendidos en la página web. a su vez, las empresas de publicidad gráfica, tendrán acceso a esta tabla para editar precios de productos. solo podrán editar precios de productos( se guardará en la base de datos), no pueden crear o eliminar productos.
  - 
- **Gestión de insumos:**
  - Empresas de insumos: editar precios de insumos. solo podrán editar precios de insumos( se guardará en la base de datos), no pueden crear o eliminar insumos. 
- **Dashboard:**
  - Vista general personalizada según el rol.
- **Cotizar producto:**
  - El cliente podrá cotizar uno o varios productos en una misma solicitud.
  - Para cada producto:
    - Seleccionar el producto a cotizar.
    - Ingresar alto y ancho (en centímetros).
  - Una vez añadidos los productos, el cliente podrá hacer clic en "Guardar cotización".
    - Al guardar, la cotización se almacena en la base de datos con una columna "Estado" que puede tener dos valores: "pendiente a publicar" o "publicado".
  - El cliente podrá publicar la cotización en el momento que desee.
    - Una vez publicada, todas las empresas de publicidad gráfica recibirán la solicitud y cotizarán automáticamente usando la fórmula:
      - ((alto * ancho) / 10000) * precio del producto seleccionado.
      - Nota: la unidad de medida de alto y ancho es en centímetros.
  - Formulario de detalles y envío de solicitud:
    - El cliente debe completar un formulario con los detalles de los productos y cualquier requerimiento adicional.
    - El sistema debe registrar la solicitud y notificar tanto al cliente como a las empresas participantes cuando la cotización sea publicada.
- **Historial de cotizaciones:**
  - Clientes: ver solicitudes y respuestas.
  - Empresas: ver cotizaciones recibidas y responder.
- **Configuración / Mi perfil:**
  - Ver y editar datos personales.
  - Ver el tipo de usuario actual.
  - Función para “Crear empresa de publicidad gráfica” o “Crear empresa de insumos”.
  - Al elegir, se solicita información de empresa y se actualiza el tipo de usuario.
- **Notificaciones:**
  - Avisos sobre nuevas cotizaciones, respuestas, etc.

### Sidebar dinámico
- El sidebar mostrará opciones distintas según el usuario autenticado:
  - **Cliente:** Cotizar producto, historial, perfil.
  - **Empresa:** Cotizaciones recibidas, gestión de productos, perfil.
  - **Empresa de insumos:** Gestión de insumos, ofertas, perfil.

## Funcionalidades clave
- **Autenticación:** Registro, login, logout, recuperación de contraseña.
- **CRUD:**
  - Clientes: gestionar solicitudes, ver historial.
  - Empresas: gestionar productos, responder cotizaciones.
  - Empresas de insumos: gestionar insumos, ofertas a empresas.
- **Notificaciones:** Avisos por email o en la plataforma sobre nuevas cotizaciones y respuestas.
- **Gestión de perfil:** Modificar datos personales o de empresa.
- **Seguridad:** Acceso restringido según rol y autenticación.

---

> **Siguiente paso:** Una vez validado este esquema, se recomienda crear wireframes o bocetos de las páginas principales antes de iniciar la implementación.
