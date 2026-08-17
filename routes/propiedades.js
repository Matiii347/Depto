const express = require('express');
const router = express.Router();
const { getPropiedades, getPropiedadById, getDisponibilidad } = require('../controllers/propiedadesController');
const { procesarReserva } = require('../controllers/reservasController');
const { getComentarios } = require('../controllers/comentariosController');

router.get('/', getPropiedades);
router.get('/:id', getPropiedadById);
router.get('/:id/disponibilidad', getDisponibilidad);
router.post('/:id/reservas', procesarReserva);
router.get('/:id/comentarios', getComentarios);

module.exports = router;
