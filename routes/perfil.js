const express = require('express');
const router = express.Router();
const db = require('../database');
const verificarSesion = require('../middleware/authMiddleware'); // Middleware de sesión

router.post('/crear-perfil', verificarSesion, (req, res) => {
    const token = req.headers['authorization'];
    const { nombre, apellido, telefono, genero } = req.body;

    // Validar que todos los datos del perfil están presentes
    if (!nombre || !apellido || !telefono || !genero) {
        return res.status(400).json({ error: 'Todos los datos son obligatorios.' });
    }

    // Obtener el user_id basado en el token de sesión
    const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
    db.query(queryUserId, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const userId = results[0].user_id;

        // Insertar el perfil en la base de datos
        const queryInsertPerfil = `
            INSERT INTO perfiles (user_id, nombre, apellido, telefono, genero) 
            VALUES (?, ?, ?, ?, ?)`;
        
        db.query(queryInsertPerfil, [userId, nombre, apellido, telefono, genero], (err) => {
            if (err) return res.status(500).json({ error: 'Error al crear el perfil.' });

            res.status(201).json({ mensaje: 'Perfil creado correctamente.' });
        });
    });
});

// Endpoint para obtener perfil
router.get('/perfil', verificarSesion, (req, res) => {
    const token = req.headers['authorization'];

    const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
    db.query(queryUserId, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const userId = results[0].user_id;

        const queryGetPerfil = 'SELECT nombre, apellido, telefono, genero FROM perfiles WHERE user_id = ?';
        db.query(queryGetPerfil, [userId], (err, results) => {
            if (err) return res.status(500).json({ error: 'Error al obtener el perfil.' });
            if (results.length === 0) {
                return res.status(404).json({ error: 'Perfil no encontrado.' });
            }

            res.status(200).json(results[0]);
        });
    });
});

// Endpoint para actualizar perfil
router.put('/perfilput', verificarSesion, (req, res) => {
    const token = req.headers['authorization'];
    const { nombre, apellido, telefono, genero } = req.body;

    if (!nombre || !apellido || !telefono || !genero) {
        return res.status(400).json({ error: 'Todos los datos son obligatorios.' });
    }

    const queryUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
    db.query(queryUserId, [token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const userId = results[0].user_id;

        const queryUpdatePerfil = `
            UPDATE perfiles 
            SET nombre = ?, apellido = ?, telefono = ?, genero = ?
            WHERE user_id = ?`;
        
        db.query(queryUpdatePerfil, [nombre, apellido, telefono, genero, userId], (err) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar el perfil.' });

            res.status(200).json({ mensaje: 'Perfil actualizado correctamente.' });
        });
    });
});


// Ruta GET para verificar si el perfil de usuario está creado
router.get('/existe-perfil', verificarSesion, async (req, res) => {
    try {
        const token = req.headers['authorization'];

        // Consulta para obtener el `user_id` usando el token de sesión
        const queryGetUserId = 'SELECT user_id FROM login WHERE session_token = ? AND tiempo_cierre IS NULL';
        const [userResult] = await db.promise().query(queryGetUserId, [token]);

        if (userResult.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.' });
        }

        const userId = userResult[0].user_id;

        // Consulta para verificar si existe un perfil en la tabla `perfiles` para el `user_id`
        const queryCheckProfile = 'SELECT * FROM perfiles WHERE user_id = ?';
        const [profileResult] = await db.promise().query(queryCheckProfile, [userId]);

        if (profileResult.length > 0) {
            return res.status(200).json({ exists: true, profile: profileResult[0] });
        } else {
            return res.status(200).json({ exists: false });
        }
    } catch (error) {
        console.error('Error al verificar el perfil:', error);
        res.status(500).json({ error: 'Error al verificar el perfil del usuario.' });
    }
});





module.exports = router;