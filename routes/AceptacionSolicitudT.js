const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database'); // Conexión a la base de datos
const verificarTecnico = require('../middleware/tecnicosmiddleware'); // Middleware de autenticaciónesion = require('../middleware/authMiddleware'); // Middleware de sesión

// Endpoint para obtener solicitudes en estado pendiente (para técnicos)
router.get('/solicitudes-pendientes', verificarTecnico, (req, res) => {
  const query = `
    SELECT 
      s.id, 
      s.user_id, 
      s.tipo_servicio_id, 
      s.nombre_servicio, 
      s.marca_ac, 
      s.tipo_ac, 
      s.detalles, 
      s.fecha, 
      s.hora, 
      s.direccion,
      u.username AS nombre_usuario,
      u.email AS correo_usuario
    FROM 
      solicitudes_servicio s
    JOIN 
      usuarios u ON s.user_id = u.id
    WHERE 
      s.estado = 'pendiente'
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener las solicitudes pendientes:', err);
      return res.status(500).json({ error: 'Error al obtener las solicitudes pendientes', detalle: err.message });
    }

    res.status(200).json(results);
  });
});



// Endpoint para aceptar una solicitud
router.put('/aceptar-solicitud/:solicitudId', verificarTecnico, (req, res) => {
  const { solicitudId } = req.params;
  const token = req.headers['authorization'];

  // Obtener el tecnico_id desde el token de sesión
  const queryTecnicoId = 'SELECT tecnico_id FROM sesiones_tecnico WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryTecnicoId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = result[0].tecnico_id;

    // Verificar si el técnico tiene solicitudes en estado "asignado"
    const queryVerificarSolicitudActiva = `
      SELECT id FROM solicitudes_servicio 
      WHERE tecnico_id = ? AND estado = 'asignado'
    `;
    db.query(queryVerificarSolicitudActiva, [tecnicoId], (err, result) => {
      if (err) {
        console.error('Error al verificar solicitudes activas:', err);
        return res.status(500).json({ error: 'Error al verificar solicitudes activas' });
      }

      // Si el técnico ya tiene una solicitud activa en estado "asignado", no puede aceptar otra
      if (result.length > 0) {
        return res.status(400).json({ error: 'El técnico ya tiene una solicitud asignada en curso.' });
      }

      // Generar un código aleatorio de 6 dígitos solo para el usuario
      const codigoInicial = crypto.randomBytes(3).toString('hex').toUpperCase();

      // Cambiar el estado de la solicitud a "asignado", registrar el técnico y guardar el código inicial
      const queryAceptarSolicitud = `
        UPDATE solicitudes_servicio 
        SET estado = 'asignado', tecnico_id = ?, codigo_inicial = ?
        WHERE id = ? AND estado = 'pendiente'
      `;

      db.query(queryAceptarSolicitud, [tecnicoId, codigoInicial, solicitudId], (err, result) => {
        if (err) {
          console.error('Error al aceptar la solicitud:', err);
          return res.status(500).json({ error: 'Error al aceptar la solicitud', detalle: err.message });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Solicitud no encontrada o ya ha sido aceptada.' });
        }

        // Obtener el user_id de la solicitud aceptada para enviar la notificación
        const queryUserId = 'SELECT user_id FROM solicitudes_servicio WHERE id = ?';
        db.query(queryUserId, [solicitudId], (err, result) => {
          if (err || result.length === 0) {
            console.error('Error al obtener el usuario para la notificación:', err);
            return res.status(500).json({ error: 'Error al obtener el usuario para la notificación', detalle: err.message });
          }

          const userId = result[0].user_id;
          const mensaje = `Un técnico ha sido asignado a tu solicitud. Usa este código para iniciar el servicio: ${codigoInicial}`;

          // Insertar la notificación en la tabla 'notificaciones'
          const queryNotificacion = 'INSERT INTO notificaciones (user_id, mensaje) VALUES (?, ?)';
          db.query(queryNotificacion, [userId, mensaje], (err) => {
            if (err) {
              console.error('Error al enviar la notificación:', err);
              return res.status(500).json({ error: 'Error al enviar la notificación', detalle: err.message });
            }

            res.status(200).json({ mensaje: 'Solicitud aceptada. El usuario ha sido notificado.' });
          });
        });
      });
    });
  });
});



router.put('/cancelar-solicitud/:solicitudId', verificarTecnico, (req, res) => {
  const { solicitudId } = req.params;
  const token = req.headers['authorization'];

  // Obtener el tecnico_id desde el token de sesión
  const queryTecnicoId = 'SELECT tecnico_id FROM sesiones_tecnico WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryTecnicoId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = result[0].tecnico_id;

    // Verificar que no haya ningún estado registrado en progreso_servicio para esta solicitud
    const queryVerificarProgreso = `
      SELECT estado FROM progreso_servicio 
      WHERE solicitud_id = ? AND tecnico_id = ?
    `;
    db.query(queryVerificarProgreso, [solicitudId, tecnicoId], (err, result) => {
      if (err) {
        console.error('Error al verificar el progreso del servicio:', err);
        return res.status(500).json({ error: 'Error al verificar el progreso del servicio' });
      }

      // Si ya hay un estado en progreso_servicio, no se puede cancelar
      if (result.length > 0) {
        return res.status(400).json({ error: 'No se puede cancelar la solicitud porque ya se ha registrado un progreso.' });
      }

      // Cambiar el estado de la solicitud a "cancelado"
      const queryCancelarSolicitud = `
        UPDATE solicitudes_servicio 
        SET estado = 'cancelado' 
        WHERE id = ? AND tecnico_id = ?
      `;
      db.query(queryCancelarSolicitud, [solicitudId, tecnicoId], (err, result) => {
        if (err) {
          console.error('Error al cancelar la solicitud:', err);
          return res.status(500).json({ error: 'Error al cancelar la solicitud' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Solicitud no encontrada o no se puede cancelar.' });
        }

        res.status(200).json({ mensaje: 'Solicitud cancelada correctamente por el técnico.' });
      });
    });
  });
});

// Endpoint para obtener las solicitudes aceptadas (en estado asignado)
router.get('/solicitudes-aceptadas', verificarTecnico, (req, res) => {
  const query = `
    SELECT 
      s.id, 
      s.nombre_servicio, 
      s.marca_ac, 
      s.tipo_ac, 
      s.detalles, 
      s.fecha, 
      s.hora, 
      s.direccion,
      s.estado,
      s.tecnico_id
    FROM 
      solicitudes_servicio s
    WHERE 
      s.estado = 'asignado' AND s.tecnico_id = ?
  `;

  const tecnicoId = req.tecnico.id; // Obtener el ID del técnico desde la sesión
  
  db.query(query, [tecnicoId], (err, results) => {
    if (err) {
      console.error('Error al obtener las solicitudes aceptadas:', err);
      return res.status(500).json({ error: 'Error al obtener las solicitudes aceptadas', detalle: err.message });
    }

    res.status(200).json(results);
  });
});

module.exports = router;


