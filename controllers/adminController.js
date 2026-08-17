const db = require('../db');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Admin login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Faltan credenciales' });
  }

  try {
    const query = `SELECT id, nombre, email, password_hash, rol FROM usuarios_admin WHERE email = $1`;
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Usuario o contraseña incorrectos' });
    }

    const admin = result.rows[0];
    const hashedInput = hashPassword(password);

    if (hashedInput !== admin.password_hash) {
      return res.status(401).json({ status: 'error', message: 'Usuario o contraseña incorrectos' });
    }

    // Return user info. In a real system, we'd sign a JWT token,
    // but for our simple admin API we return the user profile and role.
    return res.status(200).json({
      status: 'success',
      data: {
        id: admin.id,
        nombre: admin.nombre,
        email: admin.email,
        rol: admin.rol
      }
    });

  } catch (error) {
    console.error("Error in login:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Modify rates
const modificarTarifas = async (req, res) => {
  const { id } = req.params;
  const { precio_base_noche, tasa_limpieza } = req.body;

  if (precio_base_noche === undefined || tasa_limpieza === undefined) {
    return res.status(400).json({ status: 'error', message: 'Precios requeridos no especificados' });
  }

  try {
    const query = `
      UPDATE propiedades
      SET precio_base_noche = $1, tasa_limpieza = $2
      WHERE id = $3 AND activo = TRUE
      RETURNING id, nombre, precio_base_noche, tasa_limpieza;
    `;
    const result = await db.query(query, [precio_base_noche, tasa_limpieza, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada o inactiva' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Tarifas actualizadas correctamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error in modificarTarifas:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Block dates manually (overbooking prevention automatically checks this too)
const bloquearFechas = async (req, res) => {
  const { id: propiedad_id } = req.params;
  const { fecha_ingreso, fecha_egreso, motivo } = req.body; // motivo: 'bloqueado_limpieza' or 'bloqueado_mantenimiento'

  if (!fecha_ingreso || !fecha_egreso || !motivo) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos de bloqueo' });
  }

  if (motivo !== 'bloqueado_limpieza' && motivo !== 'bloqueado_mantenimiento') {
    return res.status(400).json({ status: 'error', message: 'Motivo de bloqueo no válido' });
  }

  const start = new Date(fecha_ingreso);
  const end = new Date(fecha_egreso);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ status: 'error', message: 'Fechas de bloqueo inválidas' });
  }

  try {
    // Check if there are overlaps with confirmed bookings or other blockages
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
        message: 'No se puede bloquear. Hay reservas o bloqueos en este rango de fechas.'
      });
    }

    const query = `
      INSERT INTO reservas (propiedad_id, fecha_ingreso, fecha_egreso, estado, huesped_nombre, huesped_contacto, pais_residencia, total_cotizacion)
      VALUES ($1, $2, $3, $4, 'Bloqueo Administrativo', '-', 'BR', 0.00)
      RETURNING id, fecha_ingreso, fecha_egreso, estado;
    `;
    const result = await db.query(query, [propiedad_id, fecha_ingreso, fecha_egreso, motivo]);

    return res.status(201).json({
      status: 'success',
      message: 'Rango de fechas bloqueado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error in bloquearFechas:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Retrieve all reservations
const getReservas = async (req, res) => {
  const { id: propiedad_id } = req.params;
  try {
    const query = `
      SELECT r.*, c.token, c.token_usado, c.puntuacion, c.texto_comentario, c.estado as comentario_estado
      FROM reservas r
      LEFT JOIN comentarios c ON r.id = c.reserva_id
      WHERE r.propiedad_id = $1
      ORDER BY r.fecha_creacion DESC
    `;
    const result = await db.query(query, [propiedad_id]);
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error("Error in getReservas:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Update status of reservation (e.g. approve, reject, finish)
const updateReservaEstado = async (req, res) => {
  const { id: reserva_id } = req.params;
  const { estado } = req.body; // 'pendiente', 'confirmada', 'rechazada', 'bloqueado_limpieza', 'bloqueado_mantenimiento'

  if (!estado) {
    return res.status(400).json({ status: 'error', message: 'Falta estado' });
  }

  try {
    const query = `
      UPDATE reservas
      SET estado = $1
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(query, [estado, reserva_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Reserva no encontrada' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Estado de reserva actualizado correctamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error in updateReservaEstado:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  modificarTarifas,
  bloquearFechas,
  getReservas,
  updateReservaEstado
};
