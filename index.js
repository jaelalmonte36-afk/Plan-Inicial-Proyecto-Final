require('dotenv').config()


const express = require('express')
const path = require('path') 
const exphbs = require('express-handlebars')
const app = express()
const port = process.env.port || 5600

app.engine(
    'hbs',
    ExpressHandlebars.engine({
        extname:'hbs',
        PartialsDir: path.join(__dirname,'views/partials'),
        LayoutsDir: path.join(_dirname,'views/layouts')
    })
)