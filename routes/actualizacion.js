const express = require('express');
const router = express.Router();
const db = require('../database');
const verificarTecnico = require('../middleware/tecnicosmiddleware');

// Definir los estados del servicio en orden
const ordenEstados = ['en_camino', 'en_lugar', 'en_proceso', 'finalizado'];

// Actualizar la ruta para aceptar `solicitudId` como parámetro
router.post('/actualizar-estado/:solicitudId', verificarTecnico, (req, res) => {
  const { estado, codigoConfirmacion, detalles } = req.body;
  const { solicitudId } = req.params; // Obtener solicitudId de los parámetros
  const tecnicoId = req.tecnico ? req.tecnico.id : null;

  if (!tecnicoId) {
    return res.status(403).json({ error: 'Acceso no autorizado.' });
  }

  // Verificar el código de confirmación para los estados `en_proceso` y `finalizado`
  if (estado === 'en_proceso' || estado === 'finalizado') {
    if (!codigoConfirmacion) {
      return res.status(400).json({ error: 'Se requiere un código de confirmación para este estado.' });
    }

    // Validar el código de confirmación
    const queryCodigo = `SELECT codigo_inicial FROM solicitudes_servicio WHERE id = ?`;
    db.query(queryCodigo, [solicitudId], (err, result) => {
      if (err) {
        console.error('Error al verificar el código de confirmación:', err);
        return res.status(500).json({ error: 'Error al verificar el código de confirmación' });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      const codigoInicial = result[0].codigo_inicial;

      if (codigoConfirmacion !== codigoInicial) {
        return res.status(400).json({ error: 'Código de confirmación incorrecto.' });
      }

      verificarYActualizarEstado(req, res, solicitudId, tecnicoId, estado, detalles);
    });
  } else {
    verificarYActualizarEstado(req, res, solicitudId, tecnicoId, estado, detalles);
  }
});

function verificarYActualizarEstado(req, res, solicitudId, tecnicoId, estado, detalles) {
  const queryUltimoEstado = `
    SELECT estado FROM progreso_servicio 
    WHERE solicitud_id = ? 
    ORDER BY id DESC LIMIT 1
  `;
  db.query(queryUltimoEstado, [solicitudId], (err, result) => {
    if (err) {
      console.error('Error al consultar el último estado:', err);
      return res.status(500).json({ error: 'Error al consultar el último estado del servicio' });
    }

    const ultimoEstado = result.length > 0 ? result[0].estado : null;
    const indiceUltimoEstado = ordenEstados.indexOf(ultimoEstado);
    const indiceNuevoEstado = ordenEstados.indexOf(estado);

    // Validar el orden de los estados
    if (indiceNuevoEstado === -1 || indiceNuevoEstado !== indiceUltimoEstado + 1) {
      return res.status(400).json({ error: 'El estado no sigue el orden requerido.' });
    }

    // Obtener el `user_id` asociado a la solicitud desde `solicitudes_servicio`
    const queryUserId = `SELECT user_id FROM solicitudes_servicio WHERE id = ?`;
    db.query(queryUserId, [solicitudId], (err, result) => {
      if (err) {
        console.error('Error al consultar user_id:', err);
        return res.status(500).json({ error: 'Error interno al consultar user_id.' });
      }
      if (result.length === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      const userId = result[0].user_id;
      if (!userId) {
        return res.status(500).json({ error: 'Error interno: user_id es NULL.' });
      }

      insertarProgresoYNotificar(req, res, solicitudId, tecnicoId, estado, detalles, userId);
    });
  });
}

function insertarProgresoYNotificar(req, res, solicitudId, tecnicoId, estado, detalles, userId) {
  const queryProgreso = `
    INSERT INTO progreso_servicio (solicitud_id, tecnico_id, estado, detalles) 
    VALUES (?, ?, ?, ?)
  `;
  db.query(queryProgreso, [solicitudId, tecnicoId, estado, detalles || null], (err) => {
    if (err) {
      console.error('Error al insertar en progreso_servicio:', err);
      return res.status(500).json({ error: 'Error al actualizar el progreso del servicio' });
    }

    const mensaje = `El estado de tu servicio ha cambiado a: ${estado}. ${detalles || ''}`;
    const queryNotificacion = `
      INSERT INTO notificaciones (user_id, mensaje) VALUES (?, ?)
    `;
    
    db.query(queryNotificacion, [userId, mensaje], (err) => {
      if (err) {
        console.error('Error al insertar en notificaciones:', err);
        return res.status(500).json({ error: 'Error al enviar la notificación' });
      }

      res.status(200).json({ mensaje: 'Estado del servicio y notificación actualizados correctamente' });
    });
  });
}

// Obtener los servicios finalizados (historial)
router.get('/servicios-finalizados', verificarTecnico, (req, res) => {
  const tecnicoId = req.tecnico.id; // Verificar si está tomando correctamente el técnico actual
  const query = `
    SELECT id, nombre_servicio, detalles, fecha, hora, direccion 
    FROM solicitudes_servicio 
    WHERE estado = 'completado' AND tecnico_id = ?
  `;
  
  db.query(query, [tecnicoId], (err, results) => {
    if (err) {
      console.error('Error al obtener los servicios finalizados:', err);
      return res.status(500).json({ error: 'Error al obtener los servicios finalizados' });
    }

    res.status(200).json(results);
  });
});

module.exports = router;
