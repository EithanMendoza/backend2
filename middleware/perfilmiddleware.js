const db = require('../database');

const verificarPerfil = (req, res, next) => {
    const token = req.headers['authorization'];

    // Obtener el user_id del token de sesión
    const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
    db.query(queryUserId, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const userId = results[0].user_id;

        // Verificar que el perfil del usuario esté completo
        console.log(`Verificando perfil para user_id: ${userId}`); // Debugging
        const queryPerfil = 'SELECT nombre, apellido, telefono, genero FROM perfiles WHERE user_id = ?'; // Cambiado a perfiles
        db.query(queryPerfil, [userId], (err, perfilResults) => {
            if (err || perfilResults.length === 0) {
                return res.status(404).json({ error: 'Perfil no encontrado.' });
            }

            const perfil = perfilResults[0];
            if (!perfil.nombre || !perfil.apellido || !perfil.telefono || !perfil.genero) {
                return res.status(400).json({ error: 'El perfil debe estar completo para acceder a esta funcionalidad.' });
            }

            next(); // Continúa a la siguiente función middleware
        });
    });
};

module.exports = verificarPerfil;



