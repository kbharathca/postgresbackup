# Postgres Backup Studio 🐘📁

![Postgres Backup Studio Banner](./assets/promo_banner.png)


[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Coolify](https://img.shields.io/badge/Coolify-Compatible-blueviolet?style=for-the-badge)](https://coolify.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

An advanced, high-performance, developer-centric logical database companion built for PostgreSQL query inspection, schema modeling, backup automation, and live db-to-db migration. Designed to deliver desktop-grade performance and a premium user experience for developers managing remote databases.

Featuring native compatibility for all PostgreSQL versions and a comprehensive query-based **pure-JavaScript dump engine fallback** for serverless environments (like AWS Lambda, Netlify, Vercel) or containerized architectures without pre-configured native client binaries.

🌐 **Live Application**: **[postgresbackup.apps.tirupatihost.in](https://postgresbackup.apps.tirupatihost.in/)**

---

## 📸 Screenshots

### Database Dashboard View
*A premium SaaS dashboard layout with real-time table catalog schemas, search indexing, and records navigation.*
![Database Dashboard View](./assets/dashboard.png)

### Live Database-to-Database Migration Modal
*Synchronize schemas, tables, sequences, constraints, and data across remote connection environments instantly.*
![Live Database Migration](./assets/migration.png)

### Migration Features & Promo Graphic
![Live DB Migration Feature Banner](./assets/promo_migration.png)

---

## 🚀 Architectural & Feature Highlights

### 1. 🔌 Dual Mode Database Connectivity
*   **Single-String Connection URL**: Direct connection support for standard strings (`postgres://username:password@hostname:5432/database`). Handles url-encoded query properties (like custom SSL queries).
*   **Structured Parameter Input**: Granular form input fields for Host, Port, Username, Password, Database Name, and SSL modes (`disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`).
*   **Ram-Only Connection Pools**: Connects and pulls metadata directly from server memory without caching credentials, database configurations, or decrypted passwords.

### 2. 📦 Universal Backup & Export Engine
Generate high-fidelity PostgreSQL schemas and data representations matching standard db client structures.
*   **Plain SQL (`.sql`)**: Human-readable SQL commands creating extensions, enums, sequences, schemas, indexes, constraints, and tables.
*   **Custom Binary Dump (`.dump`)**: Fast compressed binary streams compatible with standard logical restore clients (`pg_restore`).
*   **Tar Archive (`.tar`)**: Grouped schema catalog details archived inside uncompressed tar format.
*   **Directory Format (`.zip`)**: Multi-file zipped schema layouts enabling parallel table-level extraction.
*   *Uses standard `archiver` streams directly in memory to compile exports without allocating temp disk storage.*

### 3. 🛡️ Intelligent Version Detection & Pure JS Dump Engine Fallback
Never run into binary version mismatch errors (`pg_dump: server version: 16.x; pg_dump version: 15.x. mismatch`).
*   **Catalog Version Discovery**: Connects, reads `SHOW server_version;`, and determines the exact major/minor deployment version.
*   **Pure JS Introspection Query Engine**: When `pg_dump` is missing, Postgres Backup Studio runs query-based schema catalog evaluations. It outputs:
    *   **Extensions**: Detects and scripts missing custom libraries.
    *   **Enums**: Introspects custom types (`pg_enum` tables) and generates `CREATE TYPE` commands.
    *   **Sequences**: Rebuilds sequences and scripts accurate values using `setval`.
    *   **Tables**: Reconstructs columns, default values, and column constraints.
    *   **Constraints**: Scripts Primary Keys, Unique Keys, Foreign Keys (matching cascades and updates), and indexes.
    *   **Data Dumps**: Iterates records to generate highly compatible `INSERT INTO` queries (escaping strings and JSON payloads).

### 4. ⚡ Live DB-to-DB Migration Tool
Migrate databases instantly from the user interface.
*   Requires zero download/upload operations.
*   Builds schema and extracts records from the Source (A) database.
*   Runs query blocks sequentially inside a secure database transaction (`BEGIN` ... `COMMIT`) on the Target (B) database.
*   Fully rolls back (`ROLLBACK`) on errors to preserve database state.

### 5. 🔍 Real-Time Database Catalog Inspector
*   **Visual Catalog List**: Instantly view table list indexes and row counts within the public schema.
*   **Schema Filtration**: Real-time fuzzy searching to filter tables index listings.
*   **Interactive Grid View**: Paginated record grids showing columns, data types, and values.
*   **Record Level Filtering**: Search table records locally from the grid.

### 6. 🐚 Automation Shell Scripts
Copy fully parameterized, timestamped bash scripts for setup inside Coolify cron-jobs, systemd timers, or aaPanel automated backup scripts.

---

## 🛠️ Technology Stack

*   **Framework**: Next.js 15 (Standalone container deployment output format).
*   **Core UI Library**: React 19 (React Server Components + client-side interactive rendering).
*   **Motion & Graphics**: `framer-motion` (`motion/react`) for desktop-grade UI animations and state-preservation transitions.
*   **Database Driver**: `pg` (Postgres Node.js client).
*   **Archiving Module**: `archiver` (JS-native directory/tar streaming library).
*   **Styling**: Tailwind CSS v4.0.

---

## 🐳 Coolify & Docker Deployment

This application includes a production-configured `Dockerfile` based on `node:20-alpine` that installs `postgresql16-client` so that native high-speed backups are always functional.

### Deploying on Coolify
1.  Connect your Git repository on the Coolify panel.
2.  Set the **Build Pack** to `Dockerfile` (it automatically resolves `./Dockerfile`).
3.  Deploy! The runner container will expose the application on port `3000`.

---

## 🚀 Running Locally

Ensure you have [Node.js](https://nodejs.org/) installed:

```bash
# Clone the repository
git clone https://github.com/kbharathca/postgresbackup.git
cd postgresbackup

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your web browser.
