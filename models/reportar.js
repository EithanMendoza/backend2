// Importar las dependencias necesarias
const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de autenticación

// Endpoint para reportar a un técnico
router.post('/reportar-tecnico', verificarSesion, (req, res) => {
  const { solicitudId, tecnicoId, descripcion } = req.body; // Datos necesarios para el reporte
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(403).json({ error: 'Acceso no autorizado.' });
  }

  // Verificar que la solicitud esté vinculada con el usuario y el técnico
  const queryVerificarSolicitud = `
    SELECT * FROM solicitudes_servicio 
    WHERE id = ? AND user_id = ? AND tecnico_id = ?
  `;
  db.query(queryVerificarSolicitud, [solicitudId, userId, tecnicoId], (err, result) => {
    if (err) {
      console.error('Error al verificar la solicitud:', err);
      return res.status(500).json({ error: 'Error al verificar la solicitud' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada o no autorizada para el reporte.' });
    }

    // Insertar el reporte en la tabla "reportes_tecnicos"
    const queryInsertarReporte = `
      INSERT INTO reportes_tecnicos (usuario_id, tecnico_id, solicitud_id, descripcion) 
      VALUES (?, ?, ?, ?)
    `;
    db.query(queryInsertarReporte, [userId, tecnicoId, solicitudId, descripcion], (err, result) => {
      if (err) {
        console.error('Error al insertar el reporte:', err);
        return res.status(500).json({ error: 'Error al crear el reporte' });
      }

      res.status(201).json({ mensaje: 'Reporte creado correctamente', reporteId: result.insertId });
    });
  });
});

module.exports = router;
