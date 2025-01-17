const express = require('express');
const router = express.Router();
const db = require('../database'); // Importa la conexión a la base de datos

// Obtener todos los usuarios con información de sesiones
router.get('/usuarios', (req, res) => {
  const query = `
    SELECT 
      u.id, 
      u.username, 
      u.email, 
      l.tiempo_inicio, 
      l.tiempo_cierre, 
      u.created_at 
    FROM 
      usuarios u
    LEFT JOIN 
      login l ON u.id = l.user_id
  `;

  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      return res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
    res.json(rows);
  });
});

router.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;

  // Eliminar registros dependientes en la tabla `perfiles`
  db.query('DELETE FROM perfiles WHERE user_id = ?', [id], (err) => {
    if (err) {
      console.error('Error al eliminar perfiles del usuario:', err);
      return res.status(500).json({ error: 'Error al eliminar perfiles del usuario' });
    }

    // Luego, elimina las sesiones del usuario en `login`
    db.query('DELETE FROM login WHERE user_id = ?', [id], (err) => {
      if (err) {
        console.error('Error al eliminar sesiones de usuario:', err);
        return res.status(500).json({ error: 'Error al eliminar sesiones de usuario' });
      }

      // Finalmente, elimina el usuario en `usuarios`
      db.query('DELETE FROM usuarios WHERE id = ?', [id], (err, result) => {
        if (err) {
          console.error('Error al eliminar usuario:', err);
          return res.status(500).json({ error: 'Error al eliminar el usuario' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado exitosamente' });
      });
    });
  });
});


// Obtener todos los perfiles de técnicos con información de sesiones
router.get('/tecnicos', (req, res) => {
  const query = `
    SELECT 
      pt.id AS perfil_id,
      pt.nombre,
      pt.apellido,
      pt.telefono,
      pt.genero,
      pt.especialidad,
      pt.experiencia,
      st.tiempo_inicio,
      st.tiempo_cierre,
      st.session_token
    FROM 
      perfil_tecnico pt
    LEFT JOIN 
      sesiones_tecnico st ON pt.tecnico_id = st.tecnico_id
  `;

  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener técnicos:', err);
      return res.status(500).json({ error: 'Error al obtener los técnicos' });
    }
    res.json(rows);
  });
});

// Eliminar un perfil de técnico por ID
router.delete('/tecnicos/:id', (req, res) => {
  const { id } = req.params;

  // Eliminar registros relacionados y el perfil
  db.query('DELETE FROM sesiones_tecnico WHERE tecnico_id = ?', [id], (err) => {
    if (err) {
      console.error('Error al eliminar sesiones del técnico:', err);
      return res.status(500).json({ error: 'Error al eliminar sesiones del técnico' });
    }

    db.query('DELETE FROM perfil_tecnico WHERE id = ?', [id], (err, result) => {
      if (err) {
        console.error('Error al eliminar técnico:', err);
        return res.status(500).json({ error: 'Error al eliminar el técnico' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Técnico no encontrado' });
      }

      res.json({ message: 'Técnico eliminado exitosamente' });
    });
  });
});

// Obtener todas las solicitudes pendientes y asignadas
router.get('/solicitudes', (req, res) => {
  const query = `
    SELECT 
      ss.id AS solicitud_id,
      ss.nombre_servicio,
      ss.marca_ac,
      ss.tipo_ac,
      ss.fecha,
      ss.hora,
      ss.direccion,
      ss.estado,
      u.username AS usuario_nombre,
      t.nombre_usuario AS tecnico_nombre,
      ts.nombre_servicio AS tipo_servicio
    FROM 
      solicitudes_servicio ss
    LEFT JOIN 
      usuarios u ON ss.user_id = u.id
    LEFT JOIN 
      tecnicos_servicio t ON ss.tecnico_id = t.id
    LEFT JOIN 
      tipos_servicio ts ON ss.tipo_servicio_id = ts.id
    WHERE 
      ss.estado IN ('pendiente', 'asignado')
    ORDER BY 
      ss.fecha ASC, ss.hora ASC
  `;

  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener solicitudes:', err);
      return res.status(500).json({ error: 'Error al obtener las solicitudes' });
    }
    res.json(rows);
  });
});

// Eliminar una solicitud si está en estado "pendiente"
router.delete('/solicitudes/:id', (req, res) => {
  const { id } = req.params;

  // Verificar si la solicitud existe y está en estado "pendiente"
  const verificarEstadoQuery = 'SELECT estado FROM solicitudes_servicio WHERE id = ?';

  db.query(verificarEstadoQuery, [id], (err, result) => {
    if (err) {
      console.error('Error al verificar estado de la solicitud:', err);
      return res.status(500).json({ error: 'Error al verificar el estado de la solicitud' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (result[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden eliminar solicitudes en estado pendiente' });
    }

    // Eliminar la solicitud
    const eliminarQuery = 'DELETE FROM solicitudes_servicio WHERE id = ?';

    db.query(eliminarQuery, [id], (err) => {
      if (err) {
        console.error('Error al eliminar solicitud:', err);
        return res.status(500).json({ error: 'Error al eliminar la solicitud' });
      }

      res.json({ message: 'Solicitud eliminada exitosamente' });
    });
  });
});



// Obtener el estado de los pagos con información del cliente y técnico
router.get('/pagos', (req, res) => {
  const query = `
    SELECT 
      p.id AS pago_id,
      p.monto,
      p.metodo_pago,
      p.estado AS estado_pago,
      p.fecha AS fecha_pago,
      u.username AS cliente_nombre,
      t.nombre_usuario AS tecnico_nombre,
      ss.nombre_servicio
    FROM 
      pagos p
    INNER JOIN 
      solicitudes_servicio ss ON p.solicitud_id = ss.id
    INNER JOIN 
      usuarios u ON ss.user_id = u.id
    LEFT JOIN 
      tecnicos_servicio t ON ss.tecnico_id = t.id
  `;

  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener pagos:', err);
      return res.status(500).json({ error: 'Error al obtener los pagos' });
    }
    res.json(rows);
  });
});





  
  module.exports = router;

