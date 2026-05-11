// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');

const app = express();

// Puerto
const port = process.env.PORT || 3000;

// =======================
// CONFIGURACIÓN HANDLEBARS
// =======================
app.engine(
    'hbs',
    exphbs.engine({
        extname: '.hbs',
        defaultLayout: 'main',
        layoutsDir: path.join(__dirname, 'views', 'layouts'),
        partialsDir: path.join(__dirname, 'views', 'partials'),
    })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// =======================
// MIDDLEWARES
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// RUTAS
// =======================

// Página principal
app.get('/', (req, res) => {
    res.render('central'); // views/central.hbs
});

// =======================
// SERVIDOR
// =======================
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});