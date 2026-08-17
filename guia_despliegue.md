# GUÍA COMPLETA DE DESPLIEGUE EN LA NUBE - PROYECTO DEPTO

Esta guía paso a paso te explicará cómo desplegar la plataforma **Depto** (Node.js + Express + PostgreSQL) en un servicio de hosting en la nube para que esté 100% pública y accesible en internet.

---

## 🛠️ PASO 1: Subir el Proyecto a GitHub

1. **Crear Repositorio en GitHub:**
   - Ingresa a [GitHub.com](https://github.com) y crea un nuevo repositorio llamado `depto` (puede ser público o privado).

2. **Inicializar Git y Subir el Código:**
   Abre la terminal en la carpeta del proyecto (`c:\Mati\Mati\Depto`) y ejecuta:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Proyecto Depto completo"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/depto.git
   git push -u origin main
   ```

---

## 🚀 PASO 2: Opción Recomendada - Despliegue en Render.com

[Render.com](https://render.com) permite alojar de forma sencilla tanto la aplicación Node.js como la Base de Datos PostgreSQL.

### Método A: Despliegue Automatizado con Blueprint (1-Clic)

1. Crea una cuenta gratuita en [Render.com](https://dashboard.render.com).
2. En el Dashboard de Render, haz clic en **"New +"** (arriba a la derecha) y selecciona **"Blueprint"**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio `depto`.
4. Render leerá automáticamente el archivo `render.yaml` del proyecto y creará:
   - Un **Servicio Web Node.js** (`depto-web`).
   - Una **Base de Datos PostgreSQL** (`depto-db`).
5. Configura los números de WhatsApp en las variables de entorno del servicio Web:
   - `WA_ADMIN_BR`: Número del administrador en Brasil (ej. `5548999999999`).
   - `WA_FAMILIA_AR`: Número de la familia propietaria en Argentina (ej. `5493510000000`).
6. Haz clic en **"Apply"**. Render compilará e iniciará el servicio automáticamente.

---

### 🗄️ PASO 3: Inicializar la Base de Datos en la Nube

Una vez que Render o Railway hayan creado la base de datos PostgreSQL:

1. **Obtener las URLs de la Base de Datos:**
   En el panel de Render, ingresa a tu base de datos (`depto-db`) para ver ambas URLs:
   - **Internal Database URL:** `postgresql://depto_user:nYARcjSHWO7uGC7aUrkOIMBzsXWyvCdb@dpg-da1k7go1ne8s73ck8u0g-a/deptos` (Se utiliza en el Web Service dentro de Render).
   - **External Database URL:** `postgresql://depto_user:nYARcjSHWO7uGC7aUrkOIMBzsXWyvCdb@dpg-da1k7go1ne8s73ck8u0g-a.oregon-postgres.render.com/deptos` (Se utiliza para conectar desde tu computadora local).

2. **Ejecutar la siembra e inicialización de la Base de Datos (`init-db`):**
   Puedes inicializar las tablas y fotos de dos formas:

   - **Opción A (Recomendada - Desde la consola de Render):**
     En el panel de Render, ve a tu Web Service (`depto-web`), entra a la pestaña **"Shell"** y ejecuta:
     ```bash
     npm run init-db
     ```

   - **Opción B (Desde tu computadora local):**
     En tu archivo `.env` local, coloca la `DATABASE_URL` externa:
     ```env
     DATABASE_URL=postgresql://depto_user:nYARcjSHWO7uGC7aUrkOIMBzsXWyvCdb@dpg-da1k7go1ne8s73ck8u0g-a.oregon-postgres.render.com/deptos
     DB_SSL=true
     ```
     Y ejecuta en tu terminal:
     ```bash
     npm run init-db
     ```

---

## 🚂 PASO 4: Opción Alternativa - Railway.app

1. Crea una cuenta en [Railway.app](https://railway.app).
2. Haz clic en **"New Project"** -> **"Deploy from GitHub repo"** y elige `depto`.
3. Haz clic en **"Add Plugin / Service"** y selecciona **PostgreSQL**.
4. En las variables del servicio Web, añade:
   - `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}`
   - `DB_SSL`: `true`
   - `WA_ADMIN_BR` y `WA_FAMILIA_AR`.
5. Abre la consola de Railway e inicializa la base de datos corriendo `npm run init-db`.

---

## 🌐 PASO 5: Probar y Asignar Dominio Personalizado

Una vez completado el despliegue:
1. Tu sitio estará disponible en una URL pública (ejemplo: `https://depto-web.onrender.com`).
2. En el panel de Render/Railway podrás conectar tu propio dominio personalizado (ej. `www.misalquileresflorianopolis.com`).

¡Tu sistema estará 100% operativo en internet! 🚀
