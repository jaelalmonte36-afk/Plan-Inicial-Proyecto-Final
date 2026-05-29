// Leer configuración de entorno para la conexión a la base de datos
require('dotenv').config();
const mysql = require('mysql2');

// Crear objeto de conexión con los datos de entorno
const connection = mysql.createConnection({
    host: process.env.DB_HOST || process.env.db_host,
    user: process.env.DB_USER || process.env.db_user,
    password: process.env.DB_PASSWORD || process.env.db_password,
    database: process.env.DB_NAME || process.env.db_name,
    port: process.env.DB_PORT || process.env.db_port
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
