const express = require('express');
const router = express.Router();
const { procesarReserva } = require('../controllers/reservasController');

router.post('/:id/reservas', procesarReserva);

module.exports = router;
