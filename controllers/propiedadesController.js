const db = require('../db');

// Get all active properties
const getPropiedades = async (req, res) => {
  try {
    const query = `
      SELECT p.*, f.url_imagen as foto_principal
      FROM propiedades p
      LEFT JOIN fotos_propiedad f ON p.id = f.propiedad_id AND f.es_principal = TRUE
      WHERE p.activo = TRUE
      ORDER BY p.id ASC
    `;
    const result = await db.query(query);
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error("Error in getPropiedades:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Get details of a single property including all photos
const getPropiedadById = async (req, res) => {
  const { id } = req.params;
  try {
    const propQuery = `SELECT * FROM propiedades WHERE id = $1 AND activo = TRUE`;
    const propResult = await db.query(propQuery, [id]);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada' });
    }

    const photosQuery = `SELECT id, url_imagen, es_principal FROM fotos_propiedad WHERE propiedad_id = $1`;
    const photosResult = await db.query(photosQuery, [id]);

    const property = propResult.rows[0];
    property.fotos = photosResult.rows;

    return res.status(200).json({ status: 'success', data: property });
  } catch (error) {
    console.error("Error in getPropiedadById:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// Get occupied dates for calendar blockout
const getDisponibilidad = async (req, res) => {
  const { id } = req.params;
  try {
    // We select reservations that are confirmed or blocked (by maintenance/cleaning)
    // Pending reservations do not block to avoid blocking dates on incomplete queries.
    const query = `
      SELECT fecha_ingreso, fecha_egreso, estado
      FROM reservas
      WHERE propiedad_id = $1
      AND estado IN ('confirmada', 'bloqueado_limpieza', 'bloqueado_mantenimiento')
      ORDER BY fecha_ingreso ASC
    `;
    const result = await db.query(query, [id]);
    
    // Map dates to return simple ranges { start, end }
    const ranges = result.rows.map(r => ({
      from: r.fecha_ingreso,
      to: r.fecha_egreso,
      estado: r.estado
    }));

    return res.status(200).json({ status: 'success', data: ranges });
  } catch (error) {
    console.error("Error in getDisponibilidad:", error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

module.exports = {
  getPropiedades,
  getPropiedadById,
  getDisponibilidad
};
