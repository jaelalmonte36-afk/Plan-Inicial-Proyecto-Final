const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/message', require('./routes/message'));

app.use(express.static(path.join(__dirname, '../FrontEnd')));
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, '../FrontEnd/formulario.html'));
});

app.listen(port, () => {
console.log('SERVER Corriendo http://localhost:3000');
});
