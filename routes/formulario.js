const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de sesión
const verificarPerfil = require('../middleware/perfilmiddleware'); // Middleware de perfil

// Endpoint para crear una solicitud de servicio
router.post('/crear-solicitud', verificarSesion, verificarPerfil, (req, res) => {
  const { num_paneles, acceso, acceso_razon, distancia_km, detalles } = req.body;
  const token = req.headers['authorization']; // Obtener el token de sesión

  // Validar que todos los campos obligatorios están presentes
  if (!num_paneles || !acceso || !distancia_km) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar presentes.' });
  }

  // Validar el nivel de acceso
  if (!['fácil', 'moderado', 'difícil'].includes(acceso)) {
    return res.status(400).json({ error: 'El nivel de acceso debe ser fácil, moderado o difícil.' });
  }

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Verificar si el usuario ya tiene una solicitud activa en estado "pendiente"
    const queryVerificarSolicitudActiva = `
      SELECT id FROM solicitudes_servicio 
      WHERE user_id = ? AND estado = 'pendiente'
    `;
    db.query(queryVerificarSolicitudActiva, [userId], (err, result) => {
      if (err) {
        console.error('Error al verificar solicitudes activas:', err);
        return res.status(500).json({ error: 'Error al verificar solicitudes activas.' });
      }

      if (result.length > 0) {
        return res.status(400).json({ error: 'Ya tienes una solicitud pendiente en curso.' });
      }

      // Calcular el precio estimado
      const calcularPrecioEstimado = (numPaneles, acceso, distanciaKm) => {
        const costoBase = 500;
        const costoPorPanel = 50;
        const costoAcceso = { fácil: 0, moderado: 200, difícil: 400 };
        const costoPorKm = 10;

        return (
          costoBase +
          numPaneles * costoPorPanel +
          costoAcceso[acceso] +
          distanciaKm * costoPorKm
        );
      };

      const precioEstimado = calcularPrecioEstimado(num_paneles, acceso, distancia_km);

      // Insertar la solicitud en la base de datos
      const queryInsertarSolicitud = `
        INSERT INTO solicitudes_servicio 
        (user_id, num_paneles, acceso, acceso_razon, distancia_km, detalles, precio_estimado, estado) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
      `;
      const values = [
        userId,
        num_paneles,
        acceso,
        acceso_razon || null,
        distancia_km,
        detalles || null,
        precioEstimado,
      ];

      db.query(queryInsertarSolicitud, values, (err, result) => {
        if (err) {
          console.error('Error al crear la solicitud de servicio:', err);
          return res.status(500).json({ error: 'Error al crear la solicitud de servicio.' });
        }

        res.status(201).json({
          mensaje: 'Solicitud de servicio creada correctamente.',
          solicitudId: result.insertId,
          precioEstimado,
        });
      });
    });
  });
});


router.delete('/cancelar-solicitud/:solicitudId', verificarSesion, (req, res) => {
  const { solicitudId } = req.params;
  const token = req.headers['authorization'];

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Verificar si el técnico aún no está en camino
    const queryEstado = `
      SELECT estado FROM progreso_servicio 
      WHERE solicitud_id = ? 
      ORDER BY id DESC LIMIT 1
    `;
    db.query(queryEstado, [solicitudId], (err, result) => {
      if (err) {
        console.error('Error al verificar el estado de la solicitud:', err);
        return res.status(500).json({ error: 'Error al verificar el estado de la solicitud' });
      }

      // Si el estado es "en_camino", no se puede cancelar
      if (result.length > 0 && result[0].estado === 'en_camino') {
        return res.status(400).json({ error: 'No se puede cancelar la solicitud: el técnico ya está en camino.' });
      }

      // Eliminar la solicitud si el técnico no está en camino
      const queryEliminarSolicitud = 'DELETE FROM solicitudes_servicio WHERE id = ? AND user_id = ?';
      db.query(queryEliminarSolicitud, [solicitudId, userId], (err, result) => {
        if (err) {
          console.error('Error al eliminar la solicitud:', err);
          return res.status(500).json({ error: 'Error al cancelar la solicitud', detalle: err.message });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Solicitud no encontrada o no se puede cancelar.' });
        }

        res.status(200).json({ mensaje: 'Solicitud cancelada correctamente.' });
      });
    });
  });
});

// Endpoint para consultar el estado de solicitudes pendientes sin asignación de técnico
router.get('/pendientes', verificarSesion, (req, res) => {
  const token = req.headers['authorization'];

  // Obtener el user_id desde el token de sesión
  const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryUserId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const userId = result[0].user_id;

    // Consultar la última solicitud del usuario y obtener su estado y detalles relevantes
    const queryEstadoSolicitud = `
      SELECT id, nombre_servicio, estado, fecha, hora, direccion, codigo_inicial, created_at
      FROM solicitudes_servicio
      WHERE user_id = ? AND estado != 'cancelado'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    db.query(queryEstadoSolicitud, [userId], (err, result) => {
      if (err) {
        console.error('Error al obtener el estado de la solicitud:', err);
        return res.status(500).json({ error: 'Error interno al obtener el estado de la solicitud.' });
      }

      if (result.length === 0) {
        return res.status(404).json({ mensaje: 'No tienes solicitudes activas registradas.' });
      }

      const solicitud = result[0];
      res.status(200).json({
        solicitudId: solicitud.id,
        nombreServicio: solicitud.nombre_servicio,
        estadoSolicitud: solicitud.estado,
        fecha: solicitud.fecha,
        hora: solicitud.hora,
        direccion: solicitud.direccion,
        codigoInicial: solicitud.codigo_inicial,
        fechaSolicitud: solicitud.created_at
      });
    });
  });
});




module.exports = router;
