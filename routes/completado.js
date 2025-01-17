const express = require('express');
const router = express.Router();
const db = require('../database'); // Asegúrate de importar tu conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de autenticación

// Endpoint para obtener el estado de progreso de una solicitud
router.get('/estado-progreso/:solicitudId', verificarSesion, (req, res) => {
  const { solicitudId } = req.params;

  // Verificar que el usuario está autenticado
  const userId = req.user ? req.user.id : null;
  if (!userId) {
    return res.status(403).json({ error: 'Acceso no autorizado.' });
  }

  // Consulta para obtener el estado actual del progreso del servicio
  const queryEstadoProgreso = `
    SELECT estado, detalles, timestamp 
    FROM progreso_servicio 
    WHERE solicitud_id = ? 
    ORDER BY id DESC 
    LIMIT 1
  `;

  db.query(queryEstadoProgreso, [solicitudId], (err, results) => {
    if (err) {
      console.error('Error al obtener el estado del progreso:', err);
      return res.status(500).json({ error: 'Error al obtener el estado del progreso del servicio.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'No se encontró el progreso para esta solicitud.' });
    }

    // Devolver el estado del progreso más reciente
    res.status(200).json({
      solicitudId,
      estado: results[0].estado,
      detalles: results[0].detalles,
      timestamp: results[0].timestamp
    });
  });
});

module.exports = router;
