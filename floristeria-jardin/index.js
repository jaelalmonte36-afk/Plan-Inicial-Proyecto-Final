require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const exphbs = require('express-handlebars');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;
const sessionCookieName = 'flor_session';
const sessions = new Map();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10
};

let db;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !storedPassword.includes(':')) return false;
  const [salt, storedHash] = storedPassword.split(':');
  const testHash = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(testHash, 'hex'));
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}

function createSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    email: user.email
  });
  res.setHeader('Set-Cookie', `${sessionCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`);
}

async function initDatabase() {
  const database = process.env.DB_NAME || 'floristeria_jardin';
  const setup = await mysql.createConnection(dbConfig);

  await setup.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await setup.end();

  db = mysql.createPool({ ...dbConfig, database });

  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      telefono VARCHAR(30) NOT NULL,
      flor_favorita VARCHAR(80) NOT NULL,
      password_hash VARCHAR(180) NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS mensajes_contacto (
      id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL,
      telefono VARCHAR(30) NOT NULL,
      asunto VARCHAR(140) NOT NULL,
      mensaje TEXT NOT NULL,
      fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS pedidos_florales (
      id_pedido INT AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NULL,
      nombre_cliente VARCHAR(120) NOT NULL,
      email_cliente VARCHAR(160) NOT NULL,
      tipo_arreglo VARCHAR(80) NOT NULL,
      ocasion VARCHAR(80) NOT NULL,
      fecha_entrega DATE NOT NULL,
      direccion_entrega VARCHAR(220) NOT NULL,
      dedicatoria TEXT,
      presupuesto DECIMAL(10, 2) NOT NULL,
      fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pedidos_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS suscripciones (
      id_suscripcion INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(160) NOT NULL UNIQUE,
      preferencia VARCHAR(80) NOT NULL,
      fecha_suscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.engine(
  'hbs',
  exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials')
  })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  const token = getCookie(req, sessionCookieName);
  req.session = token && sessions.has(token) ? { user: sessions.get(token), token } : {};
  res.locals.currentUser = req.session.user;
  next();
});

app.get('/', (req, res) => {
  res.render('home', {
    title: 'Floristeria Jardin',
    pageClass: 'home-page'
  });
});

app.get('/arreglos', (req, res) => {
  res.render('arreglos', {
    title: 'Arreglos florales',
    pageClass: 'arrangements-page'
  });
});

app.get('/pedido', (req, res) => {
  res.render('pedido', {
    title: 'Hacer pedido',
    pageClass: 'order-page'
  });
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Iniciar sesion', pageClass: 'auth-page' });
});

app.get('/registro', (req, res) => {
  res.render('registro', { title: 'Registro', pageClass: 'auth-page' });
});

app.get('/mi-cuenta', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const [pedidos] = await db.query(
    `SELECT tipo_arreglo, ocasion, fecha_entrega, direccion_entrega, presupuesto, fecha_pedido
     FROM pedidos_florales
     WHERE id_usuario = ?
     ORDER BY id_pedido DESC
     LIMIT 20`,
    [req.session.user.id_usuario]
  );

  res.render('cuenta', {
    title: 'Mi cuenta',
    pageClass: 'account-page',
    pedidos
  });
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: Boolean(req.session.user), user: req.session.user || null });
});

app.post('/api/registro', async (req, res) => {
  const { nombre, email, telefono, flor_favorita, password } = req.body;

  if (!nombre || !email || !telefono || !flor_favorita || !password) {
    return res.status(400).json({ message: 'Completa todos los campos del registro.' });
  }

  try {
    const [existing] = await db.query('SELECT id_usuario FROM usuarios WHERE email = ? LIMIT 1', [email.trim()]);
    if (existing.length) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
    }

    const [result] = await db.query(
      `INSERT INTO usuarios (nombre, email, telefono, flor_favorita, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre.trim(), email.trim(), telefono.trim(), flor_favorita.trim(), hashPassword(password)]
    );

    createSession(res, { id_usuario: result.insertId, nombre: nombre.trim(), email: email.trim() });
    return res.status(201).json({ message: 'Registro guardado en la base de datos.', redirectTo: '/' });
  } catch (error) {
    console.error('Error registro:', error);
    return res.status(500).json({ message: 'No se pudo registrar el usuario.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Escribe tu correo y contrasena.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM usuarios WHERE email = ? LIMIT 1', [email.trim()]);
    const user = users[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' });
    }

    createSession(res, user);
    return res.json({ message: 'Sesion iniciada correctamente.', redirectTo: '/' });
  } catch (error) {
    console.error('Error login:', error);
    return res.status(500).json({ message: 'No se pudo iniciar sesion.' });
  }
});

app.post('/api/logout', (req, res) => {
  if (req.session.token) sessions.delete(req.session.token);
  res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ message: 'Sesion cerrada.', redirectTo: '/' });
});

app.post('/api/contacto', async (req, res) => {
  const { nombre, email, telefono, asunto, mensaje } = req.body;

  if (!nombre || !email || !telefono || !asunto || !mensaje) {
    return res.status(400).json({ message: 'Completa todos los campos del contacto.' });
  }

  try {
    await db.query(
      `INSERT INTO mensajes_contacto (nombre, email, telefono, asunto, mensaje)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre.trim(), email.trim(), telefono.trim(), asunto.trim(), mensaje.trim()]
    );
    return res.status(201).json({ message: 'Mensaje enviado y guardado en la base de datos.' });
  } catch (error) {
    console.error('Error contacto:', error);
    return res.status(500).json({ message: 'No se pudo guardar el mensaje.' });
  }
});

app.post('/api/pedidos', async (req, res) => {
  const {
    nombre_cliente,
    email_cliente,
    tipo_arreglo,
    ocasion,
    fecha_entrega,
    direccion_entrega,
    dedicatoria,
    presupuesto
  } = req.body;

  if (!nombre_cliente || !email_cliente || !tipo_arreglo || !ocasion || !fecha_entrega || !direccion_entrega || !presupuesto) {
    return res.status(400).json({ message: 'Completa todos los campos requeridos del pedido.' });
  }

  try {
    await db.query(
      `INSERT INTO pedidos_florales
        (id_usuario, nombre_cliente, email_cliente, tipo_arreglo, ocasion, fecha_entrega, direccion_entrega, dedicatoria, presupuesto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user?.id_usuario || null,
        nombre_cliente.trim(),
        email_cliente.trim(),
        tipo_arreglo,
        ocasion,
        fecha_entrega,
        direccion_entrega.trim(),
        dedicatoria?.trim() || null,
        Number(presupuesto)
      ]
    );
    return res.status(201).json({ message: 'Pedido floral guardado en la base de datos.' });
  } catch (error) {
    console.error('Error pedido:', error);
    return res.status(500).json({ message: 'No se pudo guardar el pedido.' });
  }
});

app.post('/api/suscripcion', async (req, res) => {
  const { email, preferencia } = req.body;

  if (!email || !preferencia) {
    return res.status(400).json({ message: 'Escribe tu correo y preferencia.' });
  }

  try {
    await db.query(
      `INSERT INTO suscripciones (email, preferencia)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE preferencia = VALUES(preferencia)`,
      [email.trim(), preferencia]
    );
    return res.status(201).json({ message: 'Suscripcion guardada en la base de datos.' });
  } catch (error) {
    console.error('Error suscripcion:', error);
    return res.status(500).json({ message: 'No se pudo guardar la suscripcion.' });
  }
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Floristeria Jardin lista en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo iniciar la base de datos:', error);
    process.exit(1);
  });
