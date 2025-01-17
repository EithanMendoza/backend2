const db = require('../database');

const verificarPerfilCompleto = (req, res, next) => {
    const tecnicoId = req.tecnico.id;

    const query = 'SELECT * FROM perfil_tecnico WHERE tecnico_id = ?';
    db.query(query, [tecnicoId], (err, result) => {
        if (err) {
            console.error('Error al verificar el perfil del técnico:', err);
            return res.status(500).json({ error: 'Error al verificar el perfil del técnico' });
        }

        if (result.length === 0) {
            return res.status(403).json({ error: 'Debes completar tu perfil antes de aceptar solicitudes de servicio.' });
        }

        next();
    });
};


module.exports = verificarPerfilCompleto;
