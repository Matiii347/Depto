const express = require('express');
const router = express.Router();
const { getComentarios, addComentario, moderarComentario } = require('../controllers/comentariosController');

router.get('/:id/comentarios', getComentarios);
router.post('/', addComentario);
router.get('/moderar', moderarComentario);

module.exports = router;
