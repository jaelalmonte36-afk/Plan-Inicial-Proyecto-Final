// Leer configuración de entorno para la conexión a la base de datos
require('dotenv').config();

const mysql = require('mysql2');

// Crear objeto de conexión con los datos de entorno
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Iniciar conexión y mostrar si hubo error o si fue exitosa
connection.connect(function(err) {
    if (err) {
        console.log('Error de conexión:', err);
    } else {
        console.log('Conexión exitosa a la base de datos');
    }
});

module.exports = connection;
