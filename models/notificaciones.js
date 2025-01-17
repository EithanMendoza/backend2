const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de sesión

// Obtener notificaciones para el usuario autenticado
router.get('/notificaciones', verificarSesion, (req, res) => {
  const token = req.headers['authorization'];

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Obtener notificaciones no leídas del usuario
    const queryNotificaciones = `
      SELECT id, mensaje, fecha, leida 
      FROM notificaciones 
      WHERE user_id = ? 
      ORDER BY fecha DESC
    `;
    db.query(queryNotificaciones, [userId], (err, results) => {
      if (err) {
        console.error('Error al obtener las notificaciones:', err);
        return res.status(500).json({ error: 'Error al obtener las notificaciones', detalle: err.message });
      }

      res.status(200).json(results);
    });
  });
});

// Marcar notificaciones como leídas
router.put('/notificaciones/marcar-leidas', verificarSesion, (req, res) => {
  const { ids } = req.body; // Lista de IDs de notificación a marcar como leídas
  const token = req.headers['authorization'];

  // Validar que se reciban IDs
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debe proporcionar una lista de IDs de notificación.' });
  }

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Actualizar las notificaciones a leídas
    const queryMarcarLeidas = `
      UPDATE notificaciones 
      SET leida = true 
      WHERE id IN (?) AND user_id = ?
    `;
    db.query(queryMarcarLeidas, [ids, userId], (err, result) => {
      if (err) {
        console.error('Error al marcar las notificaciones como leídas:', err);
        return res.status(500).json({ error: 'Error al marcar las notificaciones como leídas', detalle: err.message });
      }

      res.status(200).json({ mensaje: 'Notificaciones marcadas como leídas correctamente' });
    });
  });
});

router.delete('/notificaciones/eliminar/:id', verificarSesion, (req, res) => {
  const { id } = req.params; // ID de la notificación a eliminar
  const token = req.headers['authorization'];

  // Paso 1: Autenticación y obtención de `user_id`
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Paso 2: Eliminar la notificación específica del usuario
    const queryEliminarNotificacion = `
      DELETE FROM notificaciones 
      WHERE id = ? AND user_id = ?
    `;
    db.query(queryEliminarNotificacion, [id, userId], (err, result) => {
      if (err) {
        console.error('Error al eliminar la notificación:', err);
        return res.status(500).json({ error: 'Error al eliminar la notificación', detalle: err.message });
      }

      // Verificación final: ¿La notificación fue eliminada?
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Notificación no encontrada o ya eliminada.' });
      }

      res.status(200).json({ mensaje: 'Notificación eliminada correctamente.' });
    });
  });
});


module.exports = router;