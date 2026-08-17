const db = require('../db');
require('dotenv').config();

// Get approved reviews for a property
const getComentarios = async (req, res) => {
  const { id: propiedad_id } = req.params;
  try {
    const query = `
      SELECT c.id, c.puntuacion, c.texto_comentario, c.fecha_creacion, r.huesped_nombre
      FROM comentarios c
      JOIN reservas r ON c.reserva_id = r.id
      WHERE r.propiedad_id = $1 AND c.estado = 'aprobado' AND c.token_usado = TRUE
      ORDER BY c.fecha_creacion DESC
    `;
    const result = await db.query(query, [propiedad_id]);
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error("Error in getComentarios:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Submit review using a UUID token
const addComentario = async (req, res) => {
  const { token, puntuacion, texto_comentario } = req.body;

  if (!token || !puntuacion) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios' });
  }

  const score = parseInt(puntuacion);
  if (isNaN(score) || score < 1 || score > 5) {
    return res.status(400).json({ status: 'error', message: 'Calificación inválida (debe ser de 1 a 5 estrellas)' });
  }

  try {
    // Check if token exists and is not used
    const tokenQuery = `SELECT id, token_usado FROM comentarios WHERE token = $1`;
    const tokenResult = await db.query(tokenQuery, [token]);

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Enlace de reseña no válido o inexistente' });
    }

    if (tokenResult.rows[0].token_usado) {
      return res.status(400).json({ status: 'error', message: 'Este enlace ya ha sido utilizado para dejar una reseña' });
    }

    // Update review content and mark as used
    const updateQuery = `
      UPDATE comentarios
      SET puntuacion = $1, texto_comentario = $2, token_usado = TRUE, estado = 'pendiente', fecha_creacion = CURRENT_TIMESTAMP
      WHERE token = $3
      RETURNING id, reserva_id;
    `;
    const updateResult = await db.query(updateQuery, [score, texto_comentario || '', token]);
    const updatedReview = updateResult.rows[0];

    // Build quick moderation URLs for the owner
    const port = process.env.PORT || 3000;
    const base = `http://localhost:${port}`; // In production, this would be the actual domain name
    const approveUrl = `${base}/api/comentarios/moderar?id=${updatedReview.id}&action=aprobar&secret=${process.env.MODERATION_SECRET}`;
    const rejectUrl = `${base}/api/comentarios/moderar?id=${updatedReview.id}&action=rechazar&secret=${process.env.MODERATION_SECRET}`;

    // Log the moderation links to the console for demonstration/development
    console.log(`\n=================== NUEVO COMENTARIO PENDIENTE ===================`);
    console.log(`Huésped ha dejado una reseña de ${score} estrellas.`);
    console.log(`Comentario: "${texto_comentario || '(Sin texto)'}"`);
    console.log(`\nEnlaces de Moderación Rápida (para copiar/pegar o hacer clic):`);
    console.log(`APROBAR: ${approveUrl}`);
    console.log(`RECHAZAR: ${rejectUrl}`);
    console.log(`==================================================================\n`);

    return res.status(200).json({
      status: 'success',
      message: '¡Gracias por tu opinión! Tu comentario ha sido enviado para moderación y aparecerá pronto.'
    });

  } catch (error) {
    console.error("Error in addComentario:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// One-click moderation endpoint (e.g. from email/whatsapp link)
const moderarComentario = async (req, res) => {
  const { id, action, secret } = req.query;

  if (!id || !action || !secret) {
    return res.status(400).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #e74c3c;">Error de Moderación</h1>
        <p>Faltan parámetros requeridos.</p>
      </div>
    `);
  }

  if (secret !== process.env.MODERATION_SECRET) {
    return res.status(403).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #e74c3c;">Acceso Denegado</h1>
        <p>La clave de seguridad de moderación es inválida.</p>
      </div>
    `);
  }

  let nuevoEstado = 'pendiente';
  if (action === 'aprobar') {
    nuevoEstado = 'aprobado';
  } else if (action === 'rechazar') {
    nuevoEstado = 'rechazado';
  } else {
    return res.status(400).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #e74c3c;">Acción no reconocida</h1>
        <p>La acción debe ser 'aprobar' o 'rechazar'.</p>
      </div>
    `);
  }

  try {
    const updateQuery = `
      UPDATE comentarios
      SET estado = $1
      WHERE id = $2
      RETURNING id, puntuacion, texto_comentario;
    `;
    const result = await db.query(updateQuery, [nuevoEstado, id]);

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: #e74c3c;">Comentario no encontrado</h1>
          <p>El comentario con ID ${id} no existe en la base de datos.</p>
        </div>
      `);
    }

    const review = result.rows[0];

    const messageHtml = nuevoEstado === 'aprobado'
      ? `<h1 style="color: #2ecc71;">✅ Comentario Aprobado</h1>
         <p>El comentario ha sido aprobado y ya es visible en la página principal.</p>`
      : `<h1 style="color: #e74c3c;">❌ Comentario Rechazado</h1>
         <p>El comentario ha sido marcado como rechazado y no se mostrará en el sitio.</p>`;

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Moderación de Reseñas - Deptos</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9fa; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; }
          .review-card { background: #f1f2f6; border-left: 5px solid #3498db; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0; text-align: left; }
          .stars { color: #f1c40f; font-size: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${messageHtml}
          <div class="review-card">
            <div class="stars">${'★'.repeat(review.puntuacion)}${'☆'.repeat(5 - review.puntuacion)}</div>
            <p style="font-style: italic; margin-top: 10px; color: #555;">"${review.texto_comentario || '(Sin texto)'}"</p>
          </div>
          <p style="font-size: 14px; color: #888; margin-top: 30px;">Puedes cerrar esta pestaña o ventana.</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Error in moderarComentario:", error);
    return res.status(500).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #e74c3c;">Error del Servidor</h1>
        <p>No se pudo completar la acción en este momento.</p>
      </div>
    `);
  }
};

module.exports = {
  getComentarios,
  addComentario,
  moderarComentario
};
