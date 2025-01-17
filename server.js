// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Importar la conexión a la base de datos
require('./database'); // Asegúrate de que la ruta es correcta

const bodyParser = require('body-parser');
// Habilitar CORS para todas las solicitudes
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Rutas
const autenticacionTecnicos = require('./models/autenticacionTecnicos');
const autenticacionUsuario = require('./models/autenticacionUsuario');
const formulario = require('./routes/formulario');
const home = require('./routes/home');
const aceptacionSolicitudT = require('./routes/AceptacionSolicitudT');
const notificaciones = require('./models/notificaciones');
const perfil = require('./routes/perfil');
const perfilTRouter = require('./routes/perfilT'); 
const actualizacion = require('./routes/actualizacion');
const pago = require('./models/pago');
const reportar = require('./models/reportar');
const finalizacion = require('./models/finalizacion');
const serviciosfinalizadosT = require('./models/serviciosfinalizadosT');
const progreso = require('./routes/progreso');
const completado = require('./routes/completado');
const administrador = require('./models/administrador');



app.use('/autenticacionTecnicos', autenticacionTecnicos);
app.use('/autenticacionUsuario', autenticacionUsuario);
app.use('/formulario', formulario);
app.use('/home', home);
app.use('/aceptacionSolicitudT', aceptacionSolicitudT);
app.use('/notificaciones', notificaciones);
app.use('/perfil', perfil);
app.use('/perfilT', perfilTRouter);
app.use('/actualizacion', actualizacion);
app.use('/pago', pago);
app.use('/reportar', reportar);
app.use('/finalizacion', finalizacion);
app.use ('/serviciosfinalizadosT', serviciosfinalizadosT);
app.use ('/progreso', progreso);
app.use ('/completado', completado);
app.use ('/administrador', administrador);





// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
    