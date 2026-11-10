BEGIN;

-- Una fila por departamento; el esquema admite cualquier cantidad de propiedades.
CREATE TABLE IF NOT EXISTS propiedades (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  ubicacion VARCHAR(200) NOT NULL,
  capacidad_personas INTEGER NOT NULL,
  precio_base_noche NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tasa_limpieza NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  moneda VARCHAR(10) DEFAULT 'BRL',
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fotos_propiedad (
  id SERIAL PRIMARY KEY,
  propiedad_id INTEGER NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  url_imagen TEXT NOT NULL,
  es_principal BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  propiedad_id INTEGER NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  fecha_ingreso DATE NOT NULL,
  fecha_egreso DATE NOT NULL,
  estado VARCHAR(30) CHECK (estado IN (
    'pendiente', 'confirmada', 'rechazada',
    'bloqueado_limpieza', 'bloqueado_mantenimiento'
  )) DEFAULT 'pendiente',
  huesped_nombre VARCHAR(150) NOT NULL,
  huesped_contacto VARCHAR(50) NOT NULL,
  pais_residencia VARCHAR(10) CHECK (pais_residencia IN ('AR', 'BR', 'OTRO')) NOT NULL,
  total_cotizacion NUMERIC(12, 2) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (fecha_egreso > fecha_ingreso)
);

CREATE TABLE IF NOT EXISTS comentarios (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER REFERENCES reservas(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE,
  token_usado BOOLEAN DEFAULT FALSE,
  puntuacion INTEGER CHECK (puntuacion BETWEEN 1 AND 5) NOT NULL,
  texto_comentario TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(20) CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')) DEFAULT 'pendiente'
);

CREATE TABLE IF NOT EXISTS usuarios_admin (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  rol VARCHAR(20) CHECK (rol IN ('PROPIETARIO', 'ADMIN_LOCAL')) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fotos_propiedad_propiedad_id
  ON fotos_propiedad(propiedad_id);
CREATE INDEX IF NOT EXISTS idx_reservas_propiedad_fechas
  ON reservas(propiedad_id, fecha_ingreso, fecha_egreso);
CREATE INDEX IF NOT EXISTS idx_comentarios_reserva_id
  ON comentarios(reserva_id);

COMMIT;
