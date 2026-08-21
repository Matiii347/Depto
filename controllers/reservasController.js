const db = require('../db');
const crypto = require('crypto');
require('dotenv').config();

function getRateForNight(dateObj) {
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  if (month === 11) return 400;
  if (month === 12) return day >= 24 ? 850 : 450;
  if (month === 1) return day <= 3 ? 850 : 700;
  if (month === 2) return 600;
  if (month === 3) return 500;
  return 130;
}

function calculateStayQuote(startDate, endDate) {
  let subtotal = 0;
  let nights = 0;
  let touchesLowSeason = false;
  
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  while (current < end) {
    const m = current.getMonth() + 1;
    if (m >= 4 && m <= 10) touchesLowSeason = true;
    
    subtotal += getRateForNight(current);
    nights++;
    current.setDate(current.getDate() + 1);
  }
  
  const tasaLimpieza = 300.00;
  const total = subtotal + tasaLimpieza;
  
  return {
    nights,
    subtotal,
    tasaLimpieza,
    total,
    touchesLowSeason
  };
}

const procesarReserva = async (req, res) => {
  const { id: propiedad_id } = req.params;
  const {
    huesped_nombre,
    huesped_contacto,
    fecha_ingreso,
    fecha_egreso,
    pais_residencia
  } = req.body;

  // 1. Basic validation
  if (!huesped_nombre || !huesped_contacto || !fecha_ingreso || !fecha_egreso || !pais_residencia) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos en la solicitud' });
  }

  const start = new Date(fecha_ingreso);
  const end = new Date(fecha_egreso);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ status: 'error', message: 'Fechas de ingreso o egreso inválidas' });
  }

  // 2. Calculate seasonal quote & validate minimum stay
  const quote = calculateStayQuote(start, end);
  if (quote.touchesLowSeason && quote.nights < 10) {
    return res.status(400).json({
      status: 'error',
      message: 'En temporada baja la estadía mínima requerida es de 10 noches.'
    });
  }

  try {
    // 3. Fetch property details
    const propQuery = `SELECT * FROM propiedades WHERE id = $1 AND activo = TRUE`;
    const propResult = await db.query(propQuery, [propiedad_id]);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada o inactiva' });
    }

    const propiedad = propResult.rows[0];

    // 4. Overbooking validation
    const overlapQuery = `
      SELECT 1 FROM reservas
      WHERE propiedad_id = $1
      AND estado IN ('confirmada', 'bloqueado_limpieza', 'bloqueado_mantenimiento')
      AND (fecha_ingreso < $3 AND fecha_egreso > $2)
      LIMIT 1
    `;
    const overlapResult = await db.query(overlapQuery, [propiedad_id, fecha_ingreso, fecha_egreso]);

    if (overlapResult.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Las fechas seleccionadas ya están ocupadas. Por favor, selecciona otro rango.'
      });
    }

    const totalCotizacion = quote.total;

    // Begin Database Transaction to insert reservation and token row
    await db.query('BEGIN');

    // 5. Insert Reservation
    const insertReservaQuery = `
      INSERT INTO reservas (propiedad_id, fecha_ingreso, fecha_egreso, estado, huesped_nombre, huesped_contacto, pais_residencia, total_cotizacion)
      VALUES ($1, $2, $3, 'pendiente', $4, $5, $6, $7)
      RETURNING id;
    `;
    const resReserva = await db.query(insertReservaQuery, [
      propiedad_id,
      fecha_ingreso,
      fecha_egreso,
      huesped_nombre,
      huesped_contacto,
      pais_residencia,
      totalCotizacion
    ]);

    const reservaId = resReserva.rows[0].id;

    // 6. Generate UUID and insert pre-generated comment row
    const reviewToken = crypto.randomUUID();
    const insertComentarioQuery = `
      INSERT INTO comentarios (reserva_id, token, token_usado, puntuacion, texto_comentario, estado)
      VALUES ($1, $2, FALSE, 5, '', 'pendiente');
    `;
    await db.query(insertComentarioQuery, [reservaId, reviewToken]);

    await db.query('COMMIT');

    // 7. Dynamic WhatsApp Message Generation
    let telefonoDestino = "";
    let mensaje = "";

    const formattedStart = start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedEnd = end.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    if (pais_residencia === 'BR') {
      telefonoDestino = process.env.WA_ADMIN_BR || "5493513425877";
      mensaje = `Olá! Sou *${huesped_nombre}*. Gostaria de solicitar uma reserva para o depto nos Ingleses.\n\n` +
                `📅 *Período:* ${formattedStart} a ${formattedEnd} (${quote.nights} noites)\n` +
                `👤 *Hóspedes:* ${propiedad.capacidad_personas} pessoas max\n` +
                `💰 *Cotação Estimada:* R$ ${quote.total.toFixed(2)} (Taxa de limpeza R$ ${quote.tasaLimpieza.toFixed(2)} inclusa)\n\n` +
                `Como posso prosseguir com o pagamento por PIX? Obrigado!`;
    } else {
      telefonoDestino = process.env.WA_FAMILIA_AR || "5493513128672";
      mensaje = `¡Hola! Soy *${huesped_nombre}*. Vi el depto en la web y quiero solicitar una reserva:\n\n` +
                `📅 *Fechas:* ${formattedStart} al ${formattedEnd} (${quote.nights} noches)\n` +
                `👥 *Huéspedes:* ${propiedad.capacidad_personas} personas max\n` +
                `💰 *Cotización Web:* R$ ${quote.total.toFixed(2)} (Incluye limpieza de R$ ${quote.tasaLimpieza.toFixed(2)})\n\n` +
                `¿Me confirman si está disponible y cómo coordinamos la seña? ¡Gracias!`;
    }

    const whatsappLink = `https://wa.me/${telefonoDestino}?text=${encodeURIComponent(mensaje)}`;

    return res.status(201).json({
      status: 'success',
      data: {
        reserva_id: reservaId,
        noches: quote.nights,
        subtotal: quote.subtotal,
        limpieza: quote.tasaLimpieza,
        total: quote.total,
        url_contacto: whatsappLink
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error("Error in procesarReserva:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

module.exports = {
  procesarReserva
};
