const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión directa a la base de datos

// Obtener los servicios desde la tabla `tipos_servicio`
router.get('/servicios', (req, res) => {
  const query = 'SELECT * FROM tipos_servicio';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los tipos de servicio:', err);
      return res.status(500).json({ error: 'Error al obtener los tipos de servicio', detalle: err.message });
    }
    
    res.status(200).json(results); // Enviar los resultados al frontend
  });
});

module.exports = router;