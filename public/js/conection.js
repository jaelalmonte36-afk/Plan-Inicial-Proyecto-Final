const mysql = require ('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    database: 'jael',
    user: 'root',
    password: '123456789'
});
db.connect (function (err){
    if (err)
        console.log (err)
    else
        console.log ('conexion exitosa')
});
