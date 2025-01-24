const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database'); // Conexión a la base de datos
const verificarTecnico = require('../middleware/tecnicosmiddleware'); // Middleware de autenticaciónesion = require('../middleware/authMiddleware'); // Middleware de sesión

// Endpoint para obtener solicitudes en estado pendiente (para técnicos)
router.get('/solicitudes-disponibles', verificarTecnico, (req, res) => {
  const token = req.headers['authorization'];

  // Obtener técnico ID desde el token
  const queryTecnicoId = 'SELECT tecnico_id FROM sesiones_tecnico WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryTecnicoId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = result[0].tecnico_id;

    // Consultar solicitudes pendientes
    const querySolicitudes = `
      SELECT id, user_id, num_paneles, acceso, acceso_razon, distancia_km, precio_estimado, detalles 
      FROM solicitudes_servicio 
      WHERE estado = 'pendiente'
    `;

    db.query(querySolicitudes, (err, solicitudes) => {
      if (err) {
        console.error('Error al obtener solicitudes disponibles:', err);
        return res.status(500).json({ error: 'Error al obtener solicitudes disponibles.' });
      }

      res.status(200).json({ solicitudes });
    });
  });
});

// Endpoint para aceptar una solicitud
router.post('/aceptar-solicitud/:id', verificarTecnico, (req, res) => {
  const solicitudId = req.params.id;
  const token = req.headers['authorization'];

  // Obtener técnico ID desde el token
  const queryTecnicoId = 'SELECT tecnico_id FROM sesiones_tecnico WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(queryTecnicoId, [token], (err, result) => {
    if (err || result.length === 0) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = result[0].tecnico_id;

    // Verificar si la capacidad del técnico ya está inicializada
    const queryCapacidad = `
      SELECT capacidad_tecnico.max_servicios, 
             COUNT(solicitudes_servicio.id) AS servicios_actuales 
      FROM capacidad_tecnico 
      LEFT JOIN solicitudes_servicio 
      ON capacidad_tecnico.tecnico_id = solicitudes_servicio.tecnico_id 
         AND solicitudes_servicio.estado = "asignada" 
      WHERE capacidad_tecnico.tecnico_id = ?
      GROUP BY capacidad_tecnico.max_servicios;
    `;

    db.query(queryCapacidad, [tecnicoId], (err, result) => {
      if (err) {
        console.error('Error al verificar la capacidad del técnico:', err);
        return res.status(500).json({ error: 'Error al verificar la capacidad del técnico.' });
      }

      if (result.length === 0) {
        // Inicializar capacidad con el primer servicio
        const queryInsertarCapacidad = `
          INSERT INTO capacidad_tecnico (tecnico_id, max_servicios) 
          VALUES (?, 3)
        `;
        db.query(queryInsertarCapacidad, [tecnicoId], (err) => {
          if (err) {
            console.error('Error al inicializar la capacidad del técnico:', err);
            return res.status(500).json({ error: 'Error al inicializar la capacidad del técnico.' });
          }

          // Continuar con el proceso tras inicializar capacidad
          return asignarSolicitud(tecnicoId, solicitudId, res);
        });
        return;
      }

      const maxServicios = result[0].max_servicios;
      const serviciosActuales = result[0].servicios_actuales;

      if (serviciosActuales >= maxServicios) {
        return res.status(400).json({ error: 'Has alcanzado el límite de servicios asignados.' });
      }

      // Continuar con la asignación
      asignarSolicitud(tecnicoId, solicitudId, res);
    });
  });
});

// Función para asignar una solicitud
function asignarSolicitud(tecnicoId, solicitudId, res) {
  const queryActualizarSolicitud = `
    UPDATE solicitudes_servicio 
    SET tecnico_id = ?, estado = 'asignada' 
    WHERE id = ? AND estado = 'pendiente'
  `;
  db.query(queryActualizarSolicitud, [tecnicoId, solicitudId], (err, result) => {
    if (err || result.affectedRows === 0) {
      console.error('Error al asignar la solicitud:', err);
      return res.status(500).json({ error: 'No se pudo asignar la solicitud. Tal vez ya no está disponible.' });
    }

    res.status(200).json({
      mensaje: 'Solicitud asignada correctamente.',
    });
  });
}


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

//Endpoint: Servicios Asignados al Técnico
router.get('/mis-servicios', verificarTecnico, (req, res) => {
  const token = req.headers['authorization'];

  // Obtener el técnico ID desde el token de sesión
  const queryTecnicoId = `
    SELECT tecnico_id 
    FROM sesiones_tecnico 
    WHERE session_token = ? AND tiempo_cierre IS NULL
  `;

  db.query(queryTecnicoId, [token], (err, result) => {
    if (err || result.length === 0) {
      console.error('Error al obtener técnico ID:', err);
      return res.status(401).json({ error: 'Sesión no válida o expirada.' });
    }

    const tecnicoId = result[0].tecnico_id;

    // Consultar servicios asignados al técnico
    const queryServicios = `
      SELECT id, user_id, num_paneles, acceso, acceso_razon, distancia_km, precio_estimado, detalles, estado 
      FROM solicitudes_servicio 
      WHERE tecnico_id = ? AND estado = 'asignada'
    `;

    db.query(queryServicios, [tecnicoId], (err, servicios) => {
      if (err) {
        console.error('Error al obtener servicios asignados:', err);
        return res.status(500).json({ error: 'Error al obtener servicios asignados.' });
      }

      res.status(200).json({ servicios });
    });
  });
});

module.exports = router;


