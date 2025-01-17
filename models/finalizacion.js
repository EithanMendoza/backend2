const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de sesión

// Obtener servicios completados para el usuario autenticado
router.get('/finalizados', verificarSesion, (req, res) => {
  const token = req.headers['authorization'];

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Consulta para obtener servicios completados
    const queryServiciosCompletados = `
      SELECT id, nombre_servicio, fecha, hora, direccion, detalles
      FROM solicitudes_servicio
      WHERE user_id = ? AND estado = 'completado'
      ORDER BY fecha DESC
    `;
    db.query(queryServiciosCompletados, [userId], (err, results) => {
      if (err) {
        console.error('Error al obtener los servicios completados:', err);
        return res.status(500).json({ error: 'Error al obtener los servicios completados' });
      }

      res.status(200).json(results);
    });
  });
});

module.exports = router;
