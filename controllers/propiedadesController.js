const db = require('../db');

const fallbackProperties = [
  {
    id: 1,
    nombre: 'Depto en Condomínio Costa do Sol',
    descripcion: 'Excelente apartamento ubicado a 250 m de la playa y a 400 m del centro de Ingleses. Tiene 2 dormitorios con aire acondicionado (1 suite), baño social completo, cocina totalmente equipada, sala de estar con ventilador, TV inteligente y wifi. Balcón con barbacoa, lavarropas y cochera cubierta privada. Incluye ropa de cama y toallas.',
    ubicacion: 'Rua das Gaivotas, Praia dos Ingleses',
    capacidad_personas: 5,
    precio_base_noche: 130,
    tasa_limpieza: 300,
    moneda: 'R$',
    activo: true,
    foto_principal: '/imgCostaDoSol/WhatsApp Image 2026-07-29 at 9.28.09 PM.jpeg'
  },
  {
    id: 2,
    nombre: 'Departamento en Residencial Villa Gentil',
    descripcion: 'Departamento completo en Praia dos Ingleses, ideal para vacacionar frente a la playa. Cuenta con 2 dormitorios cómodos, 2 baños, cocina totalmente equipada, sala de estar con ventilación natural, wifi, lavandería y cochera cubierta. Disfrutá de una ubicación estratégica, a pocos minutos de la playa y del centro, con ambiente tranquilo para familias o grupos de amigos.',
    ubicacion: 'Praia dos Ingleses, Florianópolis',
    capacidad_personas: 5,
    precio_base_noche: 130,
    tasa_limpieza: 300,
    moneda: 'R$',
    activo: true,
    foto_principal: '/imgResidencialGentil/WhatsApp Image 2026-10-11 at 8.15.51 PM (1).jpeg'
  }
];

const resolveFallbackProperty = (id) => fallbackProperties.find(property => Number(property.id) === Number(id)) || null;

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
    console.error('Error in getPropiedades:', error);
    return res.status(200).json({ status: 'success', data: fallbackProperties });
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
    console.error('Error in getPropiedadById:', error);
    const fallbackProperty = resolveFallbackProperty(id);
    if (!fallbackProperty) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada' });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        ...fallbackProperty,
        fotos: [
          { url_imagen: fallbackProperty.foto_principal, es_principal: true },
          { url_imagen: fallbackProperty.foto_principal, es_principal: false }
        ]
      }
    });
  }
};

// Get occupied dates for calendar blockout
const getDisponibilidad = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT fecha_ingreso, fecha_egreso, estado
      FROM reservas
      WHERE propiedad_id = $1
      AND estado IN ('confirmada', 'bloqueado_limpieza', 'bloqueado_mantenimiento')
      ORDER BY fecha_ingreso ASC
    `;
    const result = await db.query(query, [id]);

    const ranges = result.rows.map(r => ({
      from: r.fecha_ingreso,
      to: r.fecha_egreso,
      estado: r.estado
    }));

    return res.status(200).json({ status: 'success', data: ranges });
  } catch (error) {
    console.error('Error in getDisponibilidad:', error);
    return res.status(200).json({ status: 'success', data: [] });
  }
};

module.exports = {
  getPropiedades,
  getPropiedadById,
  getDisponibilidad
};
