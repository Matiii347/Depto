const express = require('express');
const router = express.Router();
const { login, modificarTarifas, bloquearFechas, getReservas, updateReservaEstado } = require('../controllers/adminController');

router.post('/login', login);
router.get('/propiedades/:id/reservas', getReservas);
router.put('/propiedades/:id/tarifas', modificarTarifas);
router.post('/propiedades/:id/bloquear', bloquearFechas);
router.put('/reservas/:id/estado', updateReservaEstado);

module.exports = router;
