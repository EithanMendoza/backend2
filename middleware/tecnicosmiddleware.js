const db = require('../database');

// Middleware para verificar la sesión del técnico
const verificarTecnico = (req, res, next) => {
    const token = req.headers['authorization'];

    // Obtener el tecnico_id a partir del token de sesión
    const queryTecnicoId = 'SELECT tecnico_id FROM sesiones_tecnico WHERE session_token = ? AND tiempo_cierre IS NULL';
    db.query(queryTecnicoId, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const tecnicoId = results[0].tecnico_id;

        // Verificar que el técnico exista en la tabla tecnicos_servicio
        const queryTecnico = 'SELECT id FROM tecnicos_servicio WHERE id = ?';
        db.query(queryTecnico, [tecnicoId], (err, tecnicoResults) => {
            if (err || tecnicoResults.length === 0) {
                return res.status(404).json({ error: 'Técnico no encontrado.' });
            }

            req.tecnico = { id: tecnicoId }; // Asigna el tecnico_id para su uso en el endpoint
            next(); // Continúa con la siguiente función middleware
        });
    });
};

module.exports = verificarTecnico;
