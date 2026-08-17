const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const useDatabaseUrl = !!process.env.DATABASE_URL;

const sslOption = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

const pgConfig = useDatabaseUrl
  ? { connectionString: process.env.DATABASE_URL, ssl: sslOption }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgre',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres'
    };

async function init() {
  let client;
  try {
    if (!useDatabaseUrl) {
      client = new Client(pgConfig);
      await client.connect();
      console.log("Connected to local PostgreSQL system database.");

      const resDb = await client.query("SELECT 1 FROM pg_database WHERE datname = 'Deptos'");
      if (resDb.rows.length === 0) {
        console.log("Database 'Deptos' does not exist. Creating it...");
        await client.query('CREATE DATABASE "Deptos"');
        console.log("Database 'Deptos' created successfully.");
      } else {
        console.log("Database 'Deptos' already exists.");
      }
      await client.end();

      const deptosConfig = { ...pgConfig, database: process.env.DB_NAME || 'Deptos' };
      client = new Client(deptosConfig);
      await client.connect();
      console.log("Connected to local 'Deptos' database.");
    } else {
      console.log("Connecting directly via DATABASE_URL to target database...");
      client = new Client(pgConfig);
      await client.connect();
      console.log("Connected to target PostgreSQL database.");
    }

    // Create Tables safely if not exists
    console.log("Ensuring database tables exist...");

    // 1. properties Table
    await client.query(`
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
    `);

    // 2. property photos Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fotos_propiedad (
        id SERIAL PRIMARY KEY,
        propiedad_id INTEGER REFERENCES propiedades(id) ON DELETE CASCADE,
        url_imagen TEXT NOT NULL,
        es_principal BOOLEAN DEFAULT FALSE
      );
    `);

    // 3. reservations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas (
        id SERIAL PRIMARY KEY,
        propiedad_id INTEGER REFERENCES propiedades(id) ON DELETE CASCADE,
        fecha_ingreso DATE NOT NULL,
        fecha_egreso DATE NOT NULL,
        estado VARCHAR(30) CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'bloqueado_limpieza', 'bloqueado_mantenimiento')) DEFAULT 'pendiente',
        huesped_nombre VARCHAR(150) NOT NULL,
        huesped_contacto VARCHAR(50) NOT NULL,
        pais_residencia VARCHAR(10) CHECK (pais_residencia IN ('AR', 'BR', 'OTRO')) NOT NULL,
        total_cotizacion NUMERIC(12, 2) NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. reviews Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        reserva_id INTEGER REFERENCES reservas(id) ON DELETE CASCADE,
        token UUID NOT NULL UNIQUE,
        token_usado BOOLEAN DEFAULT FALSE,
        puntuacion INTEGER CHECK (puntuacion >= 1 AND puntuacion <= 5) NOT NULL,
        texto_comentario TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(20) CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')) DEFAULT 'pendiente'
      );
    `);

    // 5. admin users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios_admin (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(256) NOT NULL,
        rol VARCHAR(20) CHECK (rol IN ('PROPIETARIO', 'ADMIN_LOCAL')) NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("All database tables verified successfully.");

    // Check if properties table needs seed data
    const propCheck = await client.query("SELECT id FROM propiedades LIMIT 1");

    if (propCheck.rows.length === 0) {
      console.log("Seeding real property data from Airbnb...");
      const insertPropRes = await client.query(`
        INSERT INTO propiedades (nombre, descripcion, ubicacion, capacidad_personas, precio_base_noche, tasa_limpieza, moneda, activo)
        VALUES (
          'Excelente apartamento a 250 m de la playa y a 400 m del centro',
          'Excelente Apartamento ubicado a 250m de la playa y a 400m del centro de los Ingleses. Con 2 dormitorios con aire acondicionado (1 suite), baño social completo, cocina totalmente equipada, gran sala de estar con ventilador, TV inteligente y wifi. Sacada con barbacoa, zona de servicio con lavarropas, garaje cubierto privado, duchas externas y espacio para guardar sillas de playa. ¡Ideal para descansar en la comodidad y excelente ubicación! Incluye ropa de cama y toallas.',
          'Rua das Gaivotas, Praia dos Ingleses, Florianópolis, Santa Catarina, Brasil',
          5,
          350.00,
          150.00,
          'R$',
          true
        ) RETURNING id;
      `);
      const propId = insertPropRes.rows[0].id;

      // Seed photos
      console.log("Seeding real property photos...");
      const photos = [
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM.jpeg', main: true },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (4).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (6).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.10 PM (4).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (11).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.08 PM.jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (1).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (2).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (3).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (5).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (7).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (8).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (9).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (10).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (12).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (13).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.09 PM (14).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.10 PM.jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.10 PM (1).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.10 PM (2).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.10 PM (3).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.11 PM.jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.11 PM (1).jpeg', main: false },
        { url: '/img/WhatsApp Image 2026-07-29 at 9.28.11 PM (2).jpeg', main: false }
      ];

      for (const photo of photos) {
        await client.query(`
          INSERT INTO fotos_propiedad (propiedad_id, url_imagen, es_principal)
          VALUES ($1, $2, $3);
        `, [propId, photo.url, photo.main]);
      }
      console.log("Property and photos seeded successfully.");
    } else {
      console.log("Database already contains property data. Skipping property seed.");
    }

    // Seed Admin Users if not already seeded
    const resAdmin = await client.query("SELECT 1 FROM usuarios_admin LIMIT 1");
    if (resAdmin.rows.length === 0) {
      console.log("Seeding admin users...");
      const hashedPass = hashPassword('Brasil2026!');
      await client.query(`
        INSERT INTO usuarios_admin (nombre, email, password_hash, rol)
        VALUES 
          ('Familia Propietaria', 'familia@alquileres.com', $1, 'PROPIETARIO'),
          ('Administrador Local', 'admin.brasil@alquileres.com', $1, 'ADMIN_LOCAL');
      `, [hashedPass]);
      console.log("Admin users seeded successfully.");
    } else {
      console.log("Admin users already seeded.");
    }

    console.log("Database initialization finished successfully!");

  } catch (err) {
    console.error("Error during database initialization:", err);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

init();
