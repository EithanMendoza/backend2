const express = require('express');
const router = express.Router();
const db = require('../database');
const verificarSesion = require('../middleware/tecnicosmiddleware'); // Middleware de autenticación

// Endpoint para crear o actualizar el perfil del técnico
router.post('/crear-perfilT', verificarSesion, (req, res) => {
    const { nombre, apellido, telefono, genero, especialidad, experiencia } = req.body;
    const tecnicoId = req.tecnico.id;

    // Verificar que todos los campos obligatorios están presentes
    if (!nombre || !apellido || !telefono || !genero || !especialidad || !experiencia) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si ya existe un perfil para el técnico
    const queryVerificarPerfil = 'SELECT * FROM perfil_tecnico WHERE tecnico_id = ?';
    db.query(queryVerificarPerfil, [tecnicoId], (err, result) => {
        if (err) {
            console.error('Error al verificar el perfil del técnico:', err);
            return res.status(500).json({ error: 'Error al verificar el perfil del técnico' });
        }

        if (result.length > 0) {
            // Si el perfil ya existe, se puede actualizar en lugar de crear uno nuevo
            const queryActualizarPerfil = `
                UPDATE perfil_tecnico
                SET nombre = ?, apellido = ?, telefono = ?, genero = ?, especialidad = ?, experiencia = ?
                WHERE tecnico_id = ?
            `;
            db.query(queryActualizarPerfil, [nombre, apellido, telefono, genero, especialidad, experiencia, tecnicoId], (err, result) => {
                if (err) {
                    console.error('Error al actualizar el perfil del técnico:', err);
                    return res.status(500).json({ error: 'Error al actualizar el perfil del técnico' });
                }

                res.status(200).json({ message: 'Perfil actualizado exitosamente' });
            });
        } else {
            // Si no existe un perfil, crearlo
            const queryCrearPerfil = `
                INSERT INTO perfil_tecnico (tecnico_id, nombre, apellido, telefono, genero, especialidad, experiencia)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(queryCrearPerfil, [tecnicoId, nombre, apellido, telefono, genero, especialidad, experiencia], (err, result) => {
                if (err) {
                    console.error('Error al crear el perfil del técnico:', err);
                    return res.status(500).json({ error: 'Error al crear el perfil del técnico' });
                }

                res.status(201).json({ message: 'Perfil creado exitosamente' });
            });
        }
    });
});
// Ruta para verificar si el perfil del técnico está completo
router.get('/completo', verificarSesion, (req, res) => {
    const tecnicoId = req.tecnico.id;

    const query = 'SELECT * FROM perfil_tecnico WHERE tecnico_id = ?';
    db.query(query, [tecnicoId], (err, result) => {
        if (err) {
            console.error('Error al verificar el perfil del técnico:', err);
            return res.status(500).json({ error: 'Error al verificar el perfil del técnico' });
        }

        if (result.length === 0) {
            return res.status(200).json({ completo: false });
        }

        res.status(200).json({ completo: true });
    });
});
// Obtener detalles del perfil (si existe)
router.get('/detalles', verificarSesion, (req, res) => {
    const tecnicoId = req.tecnico.id;

    const query = 'SELECT nombre, apellido, telefono, genero, especialidad, experiencia FROM perfil_tecnico WHERE tecnico_id = ?';
    db.query(query, [tecnicoId], (err, result) => {
        if (err) {
            console.error('Error al obtener el perfil del técnico:', err);
            return res.status(500).json({ error: 'Error al obtener el perfil del técnico' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        res.status(200).json(result[0]);
    });
});



module.exports = router;
