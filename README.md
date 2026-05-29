# Michelle Ultra Services

Sistema web para gestionar servicios del hogar como pintura, reparacion electrica, reparaciones generales y limpieza. La aplicacion permite que los usuarios creen una cuenta, inicien sesion, soliciten inspecciones de propiedades y que los administradores registren procesos internos como pagos y compras de materiales.

## Descripcion del Proyecto

Michelle Ultra Services resuelve el problema de organizar solicitudes de servicios para propiedades. En lugar de manejar inspecciones, clientes, pagos y compras de materiales de forma separada, el sistema centraliza la informacion en una base de datos MySQL.

El flujo principal es:

1. El usuario se registra como cliente.
2. El usuario inicia sesion.
3. El usuario solicita una inspeccion desde una pagina de servicio.
4. La direccion se guarda de forma atomizada en la base de datos.
5. La inspeccion queda registrada para revision.
6. Los administradores pueden acceder a procesos internos como registro de pagos y compras de materiales.

## Tecnologias

- Node.js `v24.15.0`
- npm `11.12.1`
- Express `^5.2.1`
- Express Handlebars `^9.0.1`
- MySQL con `mysql2 ^3.22.4`
- Bootstrap `^5.3.8`
- Font Awesome
- dotenv `^17.4.2`
- nodemon `^3.1.14`

## Instalacion

1. Clonar el repositorio:

git clone <url-del-repositorio>
cd <nombre-del-proyecto>

2. Instalar dependencias:

npm install

3. Crear el archivo `.env` en la raiz del proyecto usando el ejemplo de abajo.

4. Ejecutar el servidor:

npm start

5. Abrir en el navegador:

http://localhost:3000

Para desarrollo con reinicio automatico:

npm run dev

## Variables de Entorno

Ejemplo de archivo `.env` sin claves reales:

db_name="michelle_ultra_services"
db_password="TU_PASSWORD"
db_port="3306"
db_user="root"
db_host="localhost"
port="3000"

El proyecto tambien acepta variables en mayusculas:

DB_NAME="michelle_ultra_services"
DB_PASSWORD="TU_PASSWORD"
DB_PORT="3306"
DB_USER="root"
DB_HOST="localhost"
PORT="3000"

## Base de Datos

La base de datos utilizada es MySQL y se llama:

michelle_ultra_services

Tablas importantes usadas por la aplicacion:

- `persona`: datos generales como nombre, email y telefono.
- `usuario`: credenciales, rol y username.
- `cliente`: cliente asociado a persona y direccion.
- `direccion`: direccion atomizada con casa, calle, ciudad, estado y codigo postal.
- `propiedad`: propiedad relacionada a una direccion.
- `inspeccion`: solicitudes de inspeccion realizadas por clientes.
- `factura_cliente`: facturas asociadas a proyectos.
- `pago`: registro de pagos.
- `factura_compra`: compras de materiales por proyecto.
- `detalle_factura_compra`: detalle de materiales comprados.

## Funcionalidades

- Pagina principal informativa.
- Paginas de servicios:
  - `/painting`
  - `/electrical`
  - `/general`
  - `/cleaning`
- Registro de usuarios:
  - `/signup`
- Inicio de sesion:
  - `/login`
- Reconocimiento visual de sesion en el menu de usuario.
- Logout desde el menu flotante.
- Solicitud de inspecciones por usuarios con rol `cliente`.
- Menu flotante para usuarios administradores.
- Procesos administrativos:
  - `/admin/payments`: registro de pagos.
  - `/admin/purchases`: registro de compras de materiales.

## Roles

- `cliente`: puede iniciar sesion y solicitar inspecciones.
- `admin`: puede acceder a los procesos administrativos.

Los usuarios con roles diferentes a `cliente` no pueden solicitar inspecciones.

## Capturas de Pantalla

Agregar aqui las capturas finales del proyecto:

### Interfaz Principal

![Interfaz principal](public/img/captura-interfaz-principal.png)

### Login

![Login](public/img/captura-login.png)

### Sign Up

![Sign Up](public/img/captura-signup.png)

### Base de Datos MySQL

![Base de datos MySQL](public/img/captura-base-datos.png)

> Nota: Las imagenes anteriores son rutas sugeridas. Para completar la documentacion, guardar las capturas reales en `public/img/` con esos nombres o actualizar las rutas.

## Scripts Disponibles

npm start

Inicia el servidor con Node.js.

npm run dev

Inicia el servidor con nodemon para desarrollo.

## Estructura del Proyecto

.
├── index.js
├── conection.js
├── package.json
├── public
│   ├── css
│   ├── img
│   └── js
└── views
    ├── layouts
    ├── partials
    └── *.hbs

## Estado del Proyecto

El proyecto incluye interfaz, autenticacion basica con sesiones, conexion a MySQL, solicitudes de inspeccion y procesos administrativos para pagos y compras de materiales.
