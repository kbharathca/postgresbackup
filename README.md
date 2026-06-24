# Postgres Backup Studio 🐘📁

A modern, high-performance database management companion designed for PostgreSQL database introspection, schema exploration, and archive generation. Features full support for all PostgreSQL versions, custom compression configurations, and a robust pure-JavaScript query fallback parser for environments where native binaries (`pg_dump`) are unavailable or mismatched.

Designed to work flawlessly as a standalone application, a local utility, or hosted via **Coolify** / Docker containers.

---

## 🌟 Key Features

* **🔌 Dual Connection Configuration**: Connect either using a single `postgres://` connection string or detailed parameters (host, port, credentials, database, and SSL modes).
* **📦 Complete Compression Options**:
  * **Plain SQL (`.sql`)**: Raw SQL statements (schema + tables + sequences + constraints + data).
  * **Custom Dump (`.dump`)**: Standard compressed binary dump compatible with `pg_restore`.
  * **Tar Archive (`.tar`)**: Structured directory format inside an uncompressed tar folder.
  * **Directory (`.zip`)**: Fully compressed ZIP directory structure.
* **🛡️ Smart Version Compatibility & JS Fallback**:
  * Automatically detects remote Postgres server versions.
  * Falls back to a custom **pure-JavaScript query engine** if `pg_dump` is missing (e.g. Serverless/Docker runtimes without PG clients) or if version mismatches would block native tools.
* **🔍 Full Interactive Records View**:
  * View public schema table catalogs with dynamic pagination.
  * Real-time search/filter inputs across catalog lists and table records.
  * Sleek data representation displaying null values and columns with custom-styled scrollbars.
* **🐚 Shell Script Generator**: Dynamic script output generator configured with your connection details for automated backup automation.
* **✨ Gorgeous User Interface**: Built using React 19, Tailwind CSS 4, and powered by `framer-motion` for fluid desktop-grade transitions.

---

## 🚀 Running Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (v20.x or higher)

### Setup & Run
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Launch the local development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`.

---

## 🐳 Docker & Coolify Deployment

This application includes a production-ready `Dockerfile` that installs `postgresql16-client` so that native high-speed backups (`pg_dump`) are always fully operational out-of-the-box.

### Deploying on Coolify
1. Commit and push the project changes to your Git repository (e.g., GitHub, GitLab).
2. Create a **New Application** in your Coolify dashboard.
3. Select your repository.
4. Set the **Build Pack** to `Dockerfile` (it will auto-detect the root `Dockerfile`).
5. Complete the setup and deploy!

---

## 🛠️ Technology Stack

* **Core**: Next.js 15 (Standalone output), React 19, TypeScript
* **Styling**: Tailwind CSS 4
* **Motion Graphics**: Framer Motion
* **Database Driver**: `pg`
* **Compression Engine**: `archiver` (JS-native zip/tar archiving)
