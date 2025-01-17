const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de autenticación

// Endpoint único para iniciar y completar el pago
router.post('/pago-completo/:solicitudId', verificarSesion, (req, res) => {
  const { metodoPago, monto } = req.body;
  const { solicitudId } = req.params; // Recupera el solicitudId como parámetro de la URL
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(403).json({ error: 'Acceso no autorizado.' });
  }

  // Verificar que el último estado en progreso_servicio sea "finalizado"
  const queryVerificarEstado = `
    SELECT estado FROM progreso_servicio 
    WHERE solicitud_id = ? 
    ORDER BY id DESC 
    LIMIT 1
  `;
  db.query(queryVerificarEstado, [solicitudId], (err, results) => {
    if (err) {
      console.error('Error al verificar el estado del servicio:', err);
      return res.status(500).json({ error: 'Error interno al verificar el estado del servicio.' });
    }

    if (results.length === 0 || results[0].estado !== 'finalizado') {
      return res.status(400).json({ error: 'El servicio no está listo para ser pagado.' });
    }

    // Registrar el pago en la tabla "pagos" con el estado "pendiente"
    const queryRegistrarPago = `
      INSERT INTO pagos (solicitud_id, monto, metodo_pago, estado) 
      VALUES (?, ?, ?, 'pendiente')
    `;
    db.query(queryRegistrarPago, [solicitudId, monto, metodoPago], (err, result) => {
      if (err) {
        console.error('Error al iniciar el pago:', err);
        return res.status(500).json({ error: 'Error al iniciar el pago' });
      }

      const pagoId = result.insertId;

      // Actualizar el progreso del servicio a "completado"
      const queryActualizarProgreso = `
        INSERT INTO progreso_servicio (solicitud_id, tecnico_id, estado, detalles) 
        VALUES (?, (SELECT tecnico_id FROM solicitudes_servicio WHERE id = ?), 'completado', 'El servicio ha sido pagado y completado.')
      `;
      
      db.query(queryActualizarProgreso, [solicitudId, solicitudId], (err) => {
        if (err) {
          console.error('Error al actualizar el progreso del servicio:', err);
          return res.status(500).json({ error: 'Error al actualizar el progreso del servicio.' });
        }

        // Actualizar el estado de la solicitud a "completado"
        const queryActualizarSolicitud = `
          UPDATE solicitudes_servicio 
          SET estado = 'completado' 
          WHERE id = ? AND user_id = ?
        `;

        db.query(queryActualizarSolicitud, [solicitudId, userId], (err) => {
          if (err) {
            console.error('Error al actualizar el estado de la solicitud:', err);
            return res.status(500).json({ error: 'Error al actualizar el estado de la solicitud.' });
          }

          // Actualizar el estado del pago a "completado"
          const queryActualizarPago = `
            UPDATE pagos 
            SET estado = 'completado' 
            WHERE id = ?
          `;
          db.query(queryActualizarPago, [pagoId], (err) => {
            if (err) {
              console.error('Error al actualizar el estado del pago:', err);
              return res.status(500).json({ error: 'Error al completar el pago' });
            }

            // Insertar una notificación para el usuario
            const mensaje = `El pago ha sido completado y el servicio se ha marcado como completado.`;
            const queryNotificacion = `
              INSERT INTO notificaciones (user_id, mensaje) VALUES (?, ?)
            `;
            
            db.query(queryNotificacion, [userId, mensaje], (err) => {
              if (err) {
                console.error('Error al insertar notificación:', err);
                return res.status(500).json({ error: 'Error al enviar la notificación' });
              }

              res.status(200).json({ mensaje: 'Pago completado y servicio marcado como completado.' });
            });
          });
        });
      });
    });
  });
});

router.get('/pagos-completados', (req, res) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(400).json({ error: 'Token no proporcionado.' });
  }

  // Obtener el tecnico_id a partir del token de sesión
  const queryTecnicoId = `
    SELECT tecnico_id FROM sesiones_tecnico 
    WHERE session_token = ? AND tiempo_cierre IS NULL
  `;
  
  db.query(queryTecnicoId, [token], (err, results) => {
    if (err) {
      console.error('Error al obtener el ID del técnico:', err);
      return res.status(500).json({ error: 'Error al verificar la sesión del técnico.' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = results[0].tecnico_id;

    // Obtener los pagos completados para el técnico específico
    const queryPagos = `
      SELECT p.id, p.solicitud_id, p.monto, p.metodo_pago, p.fecha, p.estado, s.nombre_servicio 
      FROM pagos p
      JOIN solicitudes_servicio s ON p.solicitud_id = s.id
      WHERE s.tecnico_id = ? AND p.estado = 'completado'
      ORDER BY p.fecha DESC
    `;

    db.query(queryPagos, [tecnicoId], (err, results) => {
      if (err) {
        console.error('Error al obtener los pagos:', err);
        return res.status(500).json({ error: 'Error interno al obtener los pagos.' });
      }

      res.status(200).json(results);
    });
  });
});
module.exports = router;
