const express = require('express');
const router = express.Router();
const db = require('../database'); // Conexión a la base de datos
const verificarTecnico = require('../middleware/tecnicosmiddleware'); // Middleware de autenticación para el técnico

// Endpoint para obtener servicios completados para el técnico autenticado
// Endpoint para obtener servicios completados para el técnico autenticado
// Endpoint para obtener servicios completados para el técnico autenticado
router.get('/servicios-completados', verificarTecnico, (req, res) => {
    const tecnicoId = req.tecnico ? req.tecnico.id : null;
  
    if (!tecnicoId) {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }
  
    const queryServiciosCompletados = `
      SELECT 
        s.id AS solicitudId,
        p.fecha AS fechaPago,
        p.monto,
        u.id AS userId,
        CONCAT(pr.nombre, ' ', pr.apellido) AS nombreUsuario
      FROM 
        solicitudes_servicio AS s
      JOIN 
        usuarios AS u ON s.user_id = u.id
      JOIN 
        perfiles AS pr ON pr.user_id = u.id
      JOIN 
        pagos AS p ON p.solicitud_id = s.id
      WHERE 
        s.tecnico_id = ? 
        AND s.estado = 'completado'
        AND p.estado = 'completado'
      ORDER BY 
        p.fecha DESC
    `;
  
    db.query(queryServiciosCompletados, [tecnicoId], (err, results) => {
      if (err) {
        console.error('Error al obtener los servicios completados:', err);
        return res.status(500).json({ error: 'Error al obtener los servicios completados' });
      }
  
      res.status(200).json(results);
    });
  });
  
  
module.exports = router;
