'use server';

import { Client } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ZipArchive, TarArchive } from 'archiver';

const execAsync = promisify(exec);

// ── Connection Config Types ────────────────────────────────────────────

export type ConnectionDetails = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslMode: string;
};

export type ConnectionConfig =
  | { type: 'url'; url: string }
  | ({ type: 'details' } & ConnectionDetails);

function buildConnectionString(config: ConnectionConfig): string {
  if (config.type === 'url') {
    return config.url.trim();
  }
  const { host, port, user, password, database, sslMode } = config;
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  let url = `postgres://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
  if (sslMode && sslMode !== 'disable') {
    url += `?sslmode=${sslMode}`;
  }
  return url;
}

// ── Server Version Detection ───────────────────────────────────────────

async function getServerMajorVersion(connectionString: string): Promise<number> {
  const client = new Client({ connectionString, statement_timeout: 10000 });
  try {
    await client.connect();
    const res = await client.query('SHOW server_version;');
    const versionStr: string = res.rows[0].server_version;
    // Version string can be "16.2" or "16.2 (Ubuntu 16.2-1.pgdg22.04+1)"
    const major = parseInt(versionStr.split('.')[0], 10);
    return isNaN(major) ? 16 : major;
  } finally {
    await client.end();
  }
}

// ── Archive Helpers (pure JS — no shell zip/tar needed) ────────────────

async function createZipFromDirectory(dirPath: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);
    archive.directory(dirPath, path.basename(dirPath));
    archive.finalize();
  });
}

async function createTarFromContent(content: string, innerFilename: string, tarPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tarPath);
    const archive = new TarArchive({});

    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);
    archive.append(content, { name: innerFilename });
    archive.finalize();
  });
}

async function createZipFromContent(content: string, innerFilename: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);
    archive.append(content, { name: innerFilename });
    archive.finalize();
  });
}

// ── Comprehensive JS SQL Dump ──────────────────────────────────────────

async function generateSqlDump(connectionString: string): Promise<string> {
  const client = new Client({ connectionString, statement_timeout: 120000 });
  await client.connect();

  let sql = '';
  sql += '-- PostgreSQL Database Dump (JS Fallback)\n';
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += '-- Note: Generated via pure JavaScript when pg_dump is unavailable.\n';
  sql += '-- Includes extensions, enums, sequences, tables, data, constraints, and indexes.\n\n';
  sql += 'SET statement_timeout = 0;\n';
  sql += "SET client_encoding = 'UTF8';\n";
  sql += 'SET standard_conforming_strings = on;\n';
  sql += 'SET check_function_bodies = false;\n\n';

  try {
    // ── Extensions ──
    try {
      const extRes = await client.query(
        `SELECT extname FROM pg_extension WHERE extname != 'plpgsql'`
      );
      for (const row of extRes.rows) {
        sql += `CREATE EXTENSION IF NOT EXISTS "${row.extname}";\n`;
      }
      if (extRes.rows.length > 0) sql += '\n';
    } catch (e) {
      sql += '-- Could not export extensions\n\n';
    }

    // ── Enum Types ──
    try {
      const enumRes = await client.query(`
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder
      `);
      const enums: Record<string, string[]> = {};
      for (const row of enumRes.rows) {
        if (!enums[row.typname]) enums[row.typname] = [];
        enums[row.typname].push(row.enumlabel);
      }
      for (const [name, labels] of Object.entries(enums)) {
        sql += `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN\n`;
        sql += `  CREATE TYPE "${name}" AS ENUM (${labels.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')});\n`;
        sql += 'END IF; END $$;\n';
      }
      if (Object.keys(enums).length > 0) sql += '\n';
    } catch (e) {
      sql += '-- Could not export enum types\n\n';
    }

    // ── Sequences ──
    try {
      const seqRes = await client.query(
        `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`
      );
      for (const row of seqRes.rows) {
        try {
          const seqDetail = await client.query(`SELECT last_value, is_called FROM "${row.sequence_name}"`);
          sql += `-- Sequence: ${row.sequence_name}\n`;
          sql += `CREATE SEQUENCE IF NOT EXISTS "${row.sequence_name}";\n`;
          if (seqDetail.rows.length > 0) {
            sql += `SELECT setval('"${row.sequence_name}"', ${seqDetail.rows[0].last_value}, ${seqDetail.rows[0].is_called});\n`;
          }
          sql += '\n';
        } catch (e) {
          sql += `-- Failed to dump sequence ${row.sequence_name}\n\n`;
        }
      }
    } catch (e) {
      sql += '-- Could not export sequences\n\n';
    }

    // ── Tables ──
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    );

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;

      // Get column definitions
      const columnsRes = await client.query(`
        SELECT column_name, data_type, udt_name, character_maximum_length,
               column_default, is_nullable, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      sql += `-- Table: ${tableName}\n`;
      sql += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;
      sql += `CREATE TABLE "${tableName}" (\n`;

      const colDefs = columnsRes.rows.map((c: any) => {
        let colType = c.data_type;
        if (c.data_type === 'USER-DEFINED') colType = `"${c.udt_name}"`;
        else if (c.data_type === 'ARRAY') colType = `${c.udt_name}`.replace(/^_/, '') + '[]';
        else if (c.data_type === 'character varying') colType = c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'varchar';
        else if (c.data_type === 'character') colType = c.character_maximum_length ? `char(${c.character_maximum_length})` : 'char';
        else if (c.data_type === 'numeric' && c.numeric_precision) colType = `numeric(${c.numeric_precision}${c.numeric_scale ? `,${c.numeric_scale}` : ''})`;
        else if (c.data_type === 'timestamp with time zone') colType = 'timestamptz';
        else if (c.data_type === 'timestamp without time zone') colType = 'timestamp';
        else if (c.data_type === 'double precision') colType = 'double precision';

        let def = `  "${c.column_name}" ${colType}`;
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      });
      sql += colDefs.join(',\n') + '\n);\n\n';

      // Export data using COPY format (efficient and PostgreSQL-native)
      try {
        const dataRes = await client.query(`SELECT * FROM "${tableName}"`);
        if (dataRes.rows.length > 0) {
          const colNames = columnsRes.rows.map((c: any) => `"${c.column_name}"`).join(', ');
          sql += `-- Data for: ${tableName} (${dataRes.rows.length} rows)\n`;
          sql += `COPY "${tableName}" (${colNames}) FROM stdin;\n`;

          for (const dataRow of dataRes.rows) {
            const values = columnsRes.rows.map((c: any) => {
              const val = dataRow[c.column_name];
              if (val === null || val === undefined) return '\\N';
              if (val instanceof Date) return val.toISOString();
              if (typeof val === 'boolean') return val ? 't' : 'f';
              if (typeof val === 'object') {
                return JSON.stringify(val)
                  .replace(/\\/g, '\\\\')
                  .replace(/\t/g, '\\t')
                  .replace(/\n/g, '\\n')
                  .replace(/\r/g, '\\r');
              }
              return String(val)
                .replace(/\\/g, '\\\\')
                .replace(/\t/g, '\\t')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
            });
            sql += values.join('\t') + '\n';
          }
          sql += '\\.\n\n';
        }
      } catch (dataErr: any) {
        sql += `-- Failed to export data for ${tableName}: ${dataErr.message}\n\n`;
      }
    }

    // ── Primary Keys & Unique Constraints ──
    try {
      const pkRes = await client.query(`
        SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
               string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
      `);
      if (pkRes.rows.length > 0) {
        sql += '-- Primary Keys & Unique Constraints\n';
        for (const row of pkRes.rows) {
          const cols = row.columns.split(', ').map((c: string) => `"${c.trim()}"`).join(', ');
          sql += `ALTER TABLE "${row.table_name}" ADD CONSTRAINT "${row.constraint_name}" ${row.constraint_type} (${cols});\n`;
        }
        sql += '\n';
      }
    } catch (e) {
      sql += '-- Could not export constraints\n\n';
    }

    // ── Foreign Keys ──
    try {
      const fkRes = await client.query(`
        SELECT
          tc.table_name,
          tc.constraint_name,
          string_agg(DISTINCT kcu.column_name, ', ') AS columns,
          ccu.table_name AS foreign_table,
          string_agg(DISTINCT ccu.column_name, ', ') AS foreign_columns,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
        GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.update_rule, rc.delete_rule
      `);
      if (fkRes.rows.length > 0) {
        sql += '-- Foreign Keys\n';
        for (const row of fkRes.rows) {
          const cols = row.columns.split(', ').map((c: string) => `"${c.trim()}"`).join(', ');
          const fCols = row.foreign_columns.split(', ').map((c: string) => `"${c.trim()}"`).join(', ');
          sql += `ALTER TABLE "${row.table_name}" ADD CONSTRAINT "${row.constraint_name}" `;
          sql += `FOREIGN KEY (${cols}) REFERENCES "${row.foreign_table}" (${fCols})`;
          if (row.delete_rule && row.delete_rule !== 'NO ACTION') sql += ` ON DELETE ${row.delete_rule}`;
          if (row.update_rule && row.update_rule !== 'NO ACTION') sql += ` ON UPDATE ${row.update_rule}`;
          sql += ';\n';
        }
        sql += '\n';
      }
    } catch (e) {
      sql += '-- Could not export foreign keys\n\n';
    }

    // ── Indexes (excluding those created by constraints) ──
    try {
      const idxRes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname NOT IN (
            SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public'
          )
      `);
      if (idxRes.rows.length > 0) {
        sql += '-- Indexes\n';
        for (const row of idxRes.rows) {
          sql += `${row.indexdef};\n`;
        }
        sql += '\n';
      }
    } catch (e) {
      sql += '-- Could not export indexes\n\n';
    }

    sql += '-- Dump complete\n';
  } finally {
    await client.end();
  }

  return sql;
}

// ════════════════════════════════════════════════════════════════════════
// Server Actions
// ════════════════════════════════════════════════════════════════════════

export async function checkConnectionAndGetTables(config: ConnectionConfig) {
  const connectionString = buildConnectionString(config);
  const client = new Client({ connectionString, statement_timeout: 10000 });
  try {
    await client.connect();

    // Get all public tables
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tables = res.rows.map(row => row.table_name);

    // Get row counts for each table
    const tableDetails = await Promise.all(tables.map(async (tableName) => {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
        return { name: tableName, rows: parseInt(countRes.rows[0].count, 10) };
      } catch (e) {
        return { name: tableName, rows: -1 };
      }
    }));

    // Get server version for display
    const versionRes = await client.query('SHOW server_version;');
    const serverVersion = versionRes.rows[0].server_version;

    return { success: true, tables: tableDetails, serverVersion };
  } catch (error: any) {
    console.error("Connection error:", error);
    return { success: false, error: error.message || 'Failed to connect to the database.' };
  } finally {
    await client.end();
  }
}

export async function performBackup(config: ConnectionConfig, format: string) {
  const connectionString = buildConnectionString(config);
  const tmpDir = os.tmpdir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = `backup_${timestamp}`;

  let pgDumpFormat = 'p';
  let extension = 'sql';

  if (format === 'dump') {
    pgDumpFormat = 'c';
    extension = 'dump';
  } else if (format === 'tar') {
    pgDumpFormat = 't';
    extension = 'tar';
  } else if (format === 'directory') {
    pgDumpFormat = 'd';
    extension = 'zip';
  }

  try {
    // ── Step 1: Find a working pg_dump ──────────────────────────────────
    let pgDumpCmd = '';
    let pgDumpEnv: NodeJS.ProcessEnv = { ...process.env };
    let serverMajor: number | null = null;

    const localPgDump = path.join(process.cwd(), 'node_modules', 'pg-dump-restore-nodejs', 'bin', 'linux', 'bin', 'pg_dump');
    const localLib = path.join(process.cwd(), 'node_modules', 'pg-dump-restore-nodejs', 'bin', 'linux', 'lib');

    // Try system pg_dump
    try {
      const { stdout } = await execAsync('pg_dump --version');
      const match = stdout.match(/(\d+)\./);
      const pgDumpMajor = match ? parseInt(match[1], 10) : null;

      serverMajor = await getServerMajorVersion(connectionString);

      if (pgDumpMajor && serverMajor && pgDumpMajor >= serverMajor) {
        pgDumpCmd = 'pg_dump';
      }
      // else: version too old, keep pgDumpCmd empty
    } catch (e) {
      // system pg_dump not found
    }

    // Try bundled local pg_dump
    if (!pgDumpCmd) {
      try {
        const localEnv = { ...process.env, LD_LIBRARY_PATH: localLib };
        const { stdout } = await execAsync(`"${localPgDump}" --version`, { env: localEnv });
        const match = stdout.match(/(\d+)\./);
        const pgDumpMajor = match ? parseInt(match[1], 10) : null;

        if (!serverMajor) serverMajor = await getServerMajorVersion(connectionString);

        if (!pgDumpMajor || !serverMajor || pgDumpMajor >= serverMajor) {
          pgDumpCmd = `"${localPgDump}"`;
          pgDumpEnv = localEnv;
        }
      } catch (e) {
        // local pg_dump not available
      }
    }

    // Auto-install matching postgresql-client from apt
    if (!pgDumpCmd) {
      if (!serverMajor) {
        try { serverMajor = await getServerMajorVersion(connectionString); } catch (e) { /* ignore */ }
      }

      if (serverMajor) {
        // Try the exact matching version first, then fall back through recent versions
        const versionsToTry = [...new Set([serverMajor, 18, 17, 16, 15, 14, 13, 12, 11, 10])];

        for (const ver of versionsToTry) {
          if (ver < serverMajor) continue; // pg_dump must be >= server version
          try {
            console.log(`Attempting to install postgresql-client-${ver}...`);
            await execAsync(
              'export DEBIAN_FRONTEND=noninteractive && dpkg --configure -a --force-confdef --force-confold 2>/dev/null; ' +
              'export DEBIAN_FRONTEND=noninteractive && apt-get update -qq 2>/dev/null && ' +
              'apt-get install -y -qq curl lsb-release gnupg2 ca-certificates > /dev/null 2>&1; ' +
              'curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --yes --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg 2>/dev/null; ' +
              'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list 2>/dev/null; ' +
              'export DEBIAN_FRONTEND=noninteractive && apt-get update -qq 2>/dev/null && ' +
              `export DEBIAN_FRONTEND=noninteractive && apt-get install -y -qq postgresql-client-${ver} > /dev/null 2>&1`,
              { timeout: 120000 }
            );

            // Try the versioned path first, then the generic command
            const versionedPath = `/usr/lib/postgresql/${ver}/bin/pg_dump`;
            try {
              await execAsync(`"${versionedPath}" --version`);
              pgDumpCmd = `"${versionedPath}"`;
              console.log(`Successfully installed and using pg_dump v${ver}`);
              break;
            } catch (e2) {
              try {
                await execAsync('pg_dump --version');
                pgDumpCmd = 'pg_dump';
                console.log(`Successfully installed postgresql-client-${ver}, using system pg_dump`);
                break;
              } catch (e3) { /* continue */ }
            }
          } catch (installErr) {
            console.log(`Failed to install postgresql-client-${ver}, trying next...`);
            continue;
          }
        }
      }
    }

    // ── Step 2: Execute backup (pg_dump or JS fallback) ────────────────
    let outputFile = '';
    let usedFallback = false;

    if (pgDumpCmd) {
      try {
        if (format === 'directory') {
          const dirPath = path.join(tmpDir, baseFilename);
          const zipPath = path.join(tmpDir, `${baseFilename}.zip`);
          await execAsync(`${pgDumpCmd} "${connectionString}" -F d -f "${dirPath}"`, { env: pgDumpEnv, timeout: 300000 });
          await createZipFromDirectory(dirPath, zipPath);
          outputFile = zipPath;
          await fs.promises.rm(dirPath, { recursive: true, force: true }).catch(() => {});
        } else {
          outputFile = path.join(tmpDir, `${baseFilename}.${extension}`);
          await execAsync(`${pgDumpCmd} "${connectionString}" -F ${pgDumpFormat} -f "${outputFile}"`, { env: pgDumpEnv, timeout: 300000 });
        }
      } catch (pgDumpError: any) {
        console.error('pg_dump execution failed, falling back to JS:', pgDumpError.stderr || pgDumpError.message);
        pgDumpCmd = '';
        outputFile = '';
      }
    }

    // JS Fallback — works for ALL formats
    if (!pgDumpCmd) {
      usedFallback = true;
      console.log(`Using pure JS fallback for ${format} export...`);
      const sql = await generateSqlDump(connectionString);

      if (format === 'sql') {
        return {
          success: true,
          filename: `${baseFilename}.sql`,
          data: Buffer.from(sql).toString('base64'),
          mimeType: 'application/sql',
          fallback: true,
        };
      } else if (format === 'tar') {
        outputFile = path.join(tmpDir, `${baseFilename}.tar`);
        await createTarFromContent(sql, `${baseFilename}.sql`, outputFile);
      } else if (format === 'directory') {
        outputFile = path.join(tmpDir, `${baseFilename}.zip`);
        await createZipFromContent(sql, `${baseFilename}.sql`, outputFile);
      } else if (format === 'dump') {
        // Cannot create pg_dump custom binary format without pg_dump.
        // Export as SQL in a zip so the user gets something useful.
        outputFile = path.join(tmpDir, `${baseFilename}_dump_fallback.zip`);
        await createZipFromContent(sql, `${baseFilename}.sql`, outputFile);
        const fileBuffer = await fs.promises.readFile(outputFile);
        const base64Data = fileBuffer.toString('base64');
        await fs.promises.unlink(outputFile).catch(console.error);
        return {
          success: true,
          filename: `${baseFilename}_dump_fallback.zip`,
          data: base64Data,
          mimeType: 'application/zip',
          fallback: true,
          note: 'pg_dump binary format unavailable. Exported as SQL inside a ZIP. Use Plain SQL format for best compatibility.',
        };
      }
    }

    // ── Step 3: Read and return the output file ────────────────────────
    if (outputFile) {
      const fileBuffer = await fs.promises.readFile(outputFile);
      const base64Data = fileBuffer.toString('base64');

      // Clean up temp file
      await fs.promises.unlink(outputFile).catch(console.error);

      return {
        success: true,
        filename: `${baseFilename}.${extension}`,
        data: base64Data,
        mimeType: format === 'sql' ? 'application/sql' :
                  format === 'directory' ? 'application/zip' :
                  format === 'tar' ? 'application/x-tar' :
                  'application/octet-stream',
        fallback: usedFallback,
      };
    }

    return { success: false, error: 'Backup process failed — no output was generated.' };
  } catch (error: any) {
    console.error("Backup error:", error);
    return { success: false, error: error.message || 'Backup process failed.' };
  }
}

export async function getTableData(config: ConnectionConfig, tableName: string, limit = 50, offset = 0) {
  const connectionString = buildConnectionString(config);
  const client = new Client({ connectionString, statement_timeout: 10000 });
  try {
    await client.connect();

    // Get column info
    const columnsRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);

    // Get data
    const dataRes = await client.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);

    // Get total count
    const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    return {
      success: true,
      columns: columnsRes.rows.map(c => ({ name: c.column_name, type: c.data_type })),
      rows: dataRes.rows,
      totalCount
    };
  } catch (error: any) {
    console.error("Fetch data error:", error);
    return { success: false, error: error.message || 'Failed to fetch table data.' };
  } finally {
    await client.end();
  }
}

export async function migrateDatabase(sourceConfig: ConnectionConfig, destConfig: ConnectionConfig) {
  const sourceUrl = buildConnectionString(sourceConfig);
  const destUrl = buildConnectionString(destConfig);

  const sourceClient = new Client({ connectionString: sourceUrl, statement_timeout: 180000 });
  const destClient = new Client({ connectionString: destUrl, statement_timeout: 180000 });

  try {
    await sourceClient.connect();
  } catch (err: any) {
    return { success: false, error: `Failed to connect to Source DB: ${err.message}` };
  }

  try {
    await destClient.connect();
  } catch (err: any) {
    await sourceClient.end();
    return { success: false, error: `Failed to connect to Destination DB: ${err.message}` };
  }

  try {
    // 1. Generate full SQL dump from source database
    const sqlDump = await generateSqlDump(sourceUrl);

    // 2. Run the SQL dump on the destination database in a transaction
    await destClient.query('BEGIN');
    
    // Split queries by semicolon (simplified execution block parser)
    // Note: since COPY uses newlines, we parse blocks carefully
    const queries = sqlDump.split(';\n');
    let copyBlock: string[] | null = null;
    let copyTable = '';

    for (let query of queries) {
      query = query.trim();
      if (!query) continue;

      if (query.startsWith('COPY "')) {
        // Starts a copy block
        const match = query.match(/COPY\s+"([^"]+)"/);
        if (match) {
          copyTable = match[1];
          copyBlock = [query];
        }
        continue;
      }

      if (copyBlock) {
        if (query.includes('\\.')) {
          // Ends copy block
          const parts = query.split('\\.');
          copyBlock.push(parts[0] + '\\.');
          
          const fullCopyStatement = copyBlock.join(';\n') + ';';
          await destClient.query(fullCopyStatement);
          
          copyBlock = null;
          copyTable = '';

          // If there's content after the \. terminator, run it
          if (parts[1] && parts[1].trim()) {
            await destClient.query(parts[1].trim() + ';');
          }
        } else {
          copyBlock.push(query);
        }
        continue;
      }

      await destClient.query(query + ';');
    }

    await destClient.query('COMMIT');
    return { success: true };
  } catch (error: any) {
    console.error("Migration error:", error);
    try {
      await destClient.query('ROLLBACK');
    } catch (rbErr) {}
    return { success: false, error: error.message || 'Migration execution failed.' };
  } finally {
    await sourceClient.end();
    await destClient.end();
  }
}
