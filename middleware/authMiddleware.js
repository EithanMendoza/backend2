const db = require('../database'); // Conexión a la base de datos

// Middleware de autenticación para verificar el token de sesión de usuarios
const verificarSesion = (req, res, next) => {
  const token = req.headers['authorization']; // El token de sesión debe enviarse en el header de autorización

  if (!token) {
    console.error('Token de sesión no proporcionado');
    return res.status(401).json({ error: 'No se ha proporcionado un token de sesión.' });
  }

  // Verificar el token en la tabla `login` para usuarios
  const query = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Error en la consulta de sesión:', err);
      return res.status(500).json({ error: 'Error al verificar la sesión', detalle: err.message });
    }

    if (results.length === 0) {
      console.warn('Token inválido o sesión expirada');
      return res.status(401).json({ error: 'Token de sesión inválido o sesión expirada.' });
    }

    // Si la sesión es válida, asigna el `user_id` y continúa con la solicitud
    req.user = { id: results[0].user_id };
    console.log('Usuario autenticado con user_id:', results[0].user_id);
    next();
  });
};

module.exports = verificarSesion;
