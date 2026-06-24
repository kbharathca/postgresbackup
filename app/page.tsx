'use client';

import React, { useState, useMemo } from 'react';
import {
  Database, Terminal, Copy, CheckCircle2, Server, Download, Shield,
  Loader2, Table, HardDrive, FileArchive, Archive, FileCode,
  ChevronLeft, Eye, EyeOff, Link2, SlidersHorizontal, Info, Zap,
  ExternalLink, RefreshCw, Layers, Sparkles, Filter, Search, ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkConnectionAndGetTables, performBackup, getTableData, migrateDatabase, testDestConnection } from './actions';
import type { ConnectionConfig } from './actions';

export default function Home() {
  // ── Connection mode ──────────────────────────────────────────────────
  const [connectionMode, setConnectionMode] = useState<'url' | 'details'>('url');

  // URL mode
  const [dbUrl, setDbUrl] = useState('');

  // Details mode
  const [dbHost, setDbHost] = useState('');
  const [dbPort, setDbPort] = useState('5432');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbSslMode, setDbSslMode] = useState('disable');
  const [showPassword, setShowPassword] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [tables, setTables] = useState<{ name: string; rows: number }[] | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Table inspection & search
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: any[]; rows: any[]; totalCount: number } | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [dataSearch, setDataSearch] = useState('');

  // ── Migration state ──────────────────────────────────────────────────
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migTargetUrl, setMigTargetUrl] = useState('');
  const [migTargetHost, setMigTargetHost] = useState('');
  const [migTargetPort, setMigTargetPort] = useState('5432');
  const [migTargetUser, setMigTargetUser] = useState('');
  const [migTargetPassword, setMigTargetPassword] = useState('');
  const [migTargetName, setMigTargetName] = useState('');
  const [migTargetSslMode, setMigTargetSslMode] = useState('disable');
  const [migTargetConnectionMode, setMigTargetConnectionMode] = useState<'url' | 'details'>('url');
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  // ── Derived values ───────────────────────────────────────────────────
  const getConnectionConfig = (): ConnectionConfig => {
    if (connectionMode === 'url') {
      return { type: 'url', url: dbUrl.trim() };
    }
    return {
      type: 'details',
      host: dbHost.trim(),
      port: dbPort.trim() || '5432',
      user: dbUser.trim(),
      password: dbPassword,
      database: dbName.trim(),
      sslMode: dbSslMode,
    };
  };

  const getMigrationDestConfig = (): ConnectionConfig => {
    if (migTargetConnectionMode === 'url') {
      return { type: 'url', url: migTargetUrl.trim() };
    }
    return {
      type: 'details',
      host: migTargetHost.trim(),
      port: migTargetPort.trim() || '5432',
      user: migTargetUser.trim(),
      password: migTargetPassword,
      database: migTargetName.trim(),
      sslMode: migTargetSslMode,
    };
  };

  const canConnect = useMemo(() => {
    if (connectionMode === 'url') return dbUrl.trim().length > 0;
    return dbHost.trim().length > 0 && dbUser.trim().length > 0 && dbName.trim().length > 0;
  }, [connectionMode, dbUrl, dbHost, dbUser, dbName]);

  const canMigrate = useMemo(() => {
    if (migTargetConnectionMode === 'url') return migTargetUrl.trim().length > 0;
    return migTargetHost.trim().length > 0 && migTargetUser.trim().length > 0 && migTargetName.trim().length > 0;
  }, [migTargetConnectionMode, migTargetUrl, migTargetHost, migTargetUser, migTargetName]);

  // Build a preview URL from details mode
  const previewUrl = useMemo(() => {
    if (connectionMode !== 'details') return '';
    if (!dbHost) return '';
    const u = encodeURIComponent(dbUser || 'user');
    const p = dbPassword ? encodeURIComponent(dbPassword) : '****';
    const d = encodeURIComponent(dbName || 'dbname');
    let url = `postgres://${u}:${p}@${dbHost}:${dbPort || '5432'}/${d}`;
    if (dbSslMode && dbSslMode !== 'disable') url += `?sslmode=${dbSslMode}`;
    return url;
  }, [connectionMode, dbHost, dbPort, dbUser, dbPassword, dbName, dbSslMode]);

  // Destination Migration URL preview
  const destPreviewUrl = useMemo(() => {
    if (migTargetConnectionMode !== 'details') return '';
    if (!migTargetHost) return '';
    const u = encodeURIComponent(migTargetUser || 'user');
    const p = migTargetPassword ? encodeURIComponent(migTargetPassword) : '****';
    const d = encodeURIComponent(migTargetName || 'dbname');
    let url = `postgres://${u}:${p}@${migTargetHost}:${migTargetPort || '5432'}/${d}`;
    if (migTargetSslMode && migTargetSslMode !== 'disable') url += `?sslmode=${migTargetSslMode}`;
    return url;
  }, [migTargetConnectionMode, migTargetHost, migTargetPort, migTargetUser, migTargetPassword, migTargetName, migTargetSslMode]);

  // For the bash script preview
  const scriptTargetUrl = useMemo(() => {
    if (connectionMode === 'url' && dbUrl.trim()) return dbUrl.trim();
    if (connectionMode === 'details' && previewUrl) return previewUrl;
    return 'postgres://user:password@hostname:5432/dbname';
  }, [connectionMode, dbUrl, previewUrl]);

  // Filters tables list by search
  const filteredTables = useMemo(() => {
    if (!tables) return [];
    return tables.filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
  }, [tables, tableSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const handleConnect = async () => {
    if (!canConnect) return;
    setIsConnecting(true);
    setConnectionError(null);
    setTables(null);
    setExportError(null);
    setExportNote(null);
    setSelectedTable(null);
    setServerVersion(null);

    try {
      const config = getConnectionConfig();
      const result = await checkConnectionAndGetTables(config);
      if (result.success && result.tables) {
        setTables(result.tables);
        if (result.serverVersion) setServerVersion(result.serverVersion);
      } else {
        setConnectionError(result.error || 'Failed to connect');
      }
    } catch (err: any) {
      setConnectionError(err.message || 'An unexpected error occurred');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    setIsFetchingData(true);
    setDataError(null);
    setPage(0);
    setDataSearch('');

    try {
      const config = getConnectionConfig();
      const result = await getTableData(config, tableName, 50, 0);
      if (result.success && result.columns && result.rows) {
        setTableData({ columns: result.columns, rows: result.rows, totalCount: result.totalCount! });
      } else {
        setDataError(result.error || 'Failed to fetch table data');
      }
    } catch (err: any) {
      setDataError(err.message || 'An unexpected error occurred');
    } finally {
      setIsFetchingData(false);
    }
  };

  const loadMoreData = async (direction: 'next' | 'prev') => {
    if (!selectedTable || !tableData) return;

    const newPage = direction === 'next' ? page + 1 : page - 1;
    if (newPage < 0) return;

    setIsFetchingData(true);
    setDataError(null);

    try {
      const config = getConnectionConfig();
      const result = await getTableData(config, selectedTable, 50, newPage * 50);
      if (result.success && result.columns && result.rows) {
        setTableData({ columns: result.columns, rows: result.rows, totalCount: result.totalCount! });
        setPage(newPage);
      } else {
        setDataError(result.error || 'Failed to fetch table data');
      }
    } catch (err: any) {
      setDataError(err.message || 'An unexpected error occurred');
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleExport = async (format: string) => {
    setIsExporting(true);
    setExportError(null);
    setExportNote(null);
    setExportProgress(`Initializing ${format.toUpperCase()} export...`);

    try {
      setExportProgress(`Running backup for ${format.toUpperCase()} format. This may take a while depending on database size...`);
      const config = getConnectionConfig();
      const result = await performBackup(config, format);

      if (result.success && result.data && result.filename) {
        setExportProgress('Preparing download...');

        // Convert base64 to Blob
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.mimeType });

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Format file size
        const sizeKB = (byteArray.length / 1024).toFixed(1);
        const sizeMB = (byteArray.length / (1024 * 1024)).toFixed(2);
        const sizeStr = byteArray.length > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

        setExportProgress(`✅ Download complete! (${sizeStr})`);
        if ((result as any).fallback) {
          setExportNote('Used JS fallback (pg_dump was unavailable or version-mismatched). The export contains full schema and data.');
        }
        if ((result as any).note) {
          setExportNote((result as any).note);
        }
        setTimeout(() => setExportProgress(''), 5000);
      } else {
        setExportError(result.error || 'Export failed');
        setExportProgress('');
      }
    } catch (err: any) {
      setExportError(err.message || 'An unexpected error occurred during export');
      setExportProgress('');
    } finally {
      setIsExporting(false);
    }
  };

  const [isTestingDest, setIsTestingDest] = useState(false);
  const [destTestError, setDestTestError] = useState<string | null>(null);
  const [destTestSuccess, setDestTestSuccess] = useState(false);

  const handleTestConnection = async () => {
    if (!canMigrate) return;
    setIsTestingDest(true);
    setDestTestError(null);
    setDestTestSuccess(false);

    try {
      const destConfig = getMigrationDestConfig();
      const result = await testDestConnection(destConfig);
      if (result.success) {
        setDestTestSuccess(true);
      } else {
        setDestTestError(result.error || 'Failed to connect to destination database');
      }
    } catch (err: any) {
      setDestTestError(err.message || 'An unexpected error occurred');
    } finally {
      setIsTestingDest(false);
    }
  };

  const handleMigration = async () => {
    if (!canMigrate) return;
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccess(false);

    try {
      const sourceConfig = getConnectionConfig();
      const destConfig = getMigrationDestConfig();
      const result = await migrateDatabase(sourceConfig, destConfig);
      if (result.success) {
        setMigrationSuccess(true);
      } else {
        setMigrationError(result.error || 'Migration failed');
      }
    } catch (err: any) {
      setMigrationError(err.message || 'An unexpected error occurred during migration');
    } finally {
      setIsMigrating(false);
    }
  };

  const nativeScript = `#!/bin/bash
# ==============================================================================
# PostgreSQL Full Remote Backup Script
# ==============================================================================

# Your Postgres Connection URL
DB_URL="${scriptTargetUrl}"

# Generate a timestamped backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="postgres_backup_\${TIMESTAMP}.sql"

echo "Starting database backup..."
echo "Target: \${OUTPUT_FILE}"

pg_dump "\${DB_URL}" \\
  --clean \\
  --if-exists \\
  --no-owner \\
  --no-privileges \\
  --format=plain \\
  > "\${OUTPUT_FILE}"

if [ $? -eq 0 ]; then
  echo "✅ Backup completed successfully!"
  echo "📁 File saved as: \${OUTPUT_FILE}"
else
  echo "❌ Backup failed."
  exit 1
fi
`;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 font-sans selection:bg-blue-500/30 relative overflow-hidden bg-grid-pattern">
      {/* Dynamic light effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-pulse-medium"></div>

      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-neutral-900 pb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-inner shadow-white/5">
              <Database className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">Postgres Backup Studio</h1>
                <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> v2.1
                </span>
              </div>
              <p className="text-neutral-400 mt-1">Explore, view table records, copy schema, and execute dynamic database-to-database migrations.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tables && (
              <button 
                onClick={() => {
                  setMigrationSuccess(false);
                  setMigrationError(null);
                  setShowMigrationModal(true);
                }}
                className="px-4.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-500/20 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-500/10"
              >
                <ArrowRightLeft className="w-4 h-4" /> Live DB Migration
              </button>
            )}
            <a 
              href="https://coolify.io" 
              target="_blank" 
              rel="noreferrer" 
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              Coolify Friendly <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ═══ Left Column (lg:col-span-5) ═══ */}
          <div className="lg:col-span-5 space-y-6">

            {/* Connection Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl shadow-xl shadow-black/50 overflow-hidden"
            >
              {/* Connection Mode Tabs */}
              <div className="flex border-b border-neutral-800 bg-neutral-950/40">
                <button
                  onClick={() => setConnectionMode('url')}
                  className={`flex-1 px-4 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all relative ${
                    connectionMode === 'url' ? 'text-blue-400 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  Database URL
                  {connectionMode === 'url' && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
                <button
                  onClick={() => setConnectionMode('details')}
                  className={`flex-1 px-4 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-all relative ${
                    connectionMode === 'details' ? 'text-blue-400 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Credentials
                  {connectionMode === 'details' && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
              </div>

              <div className="p-6">
                {/* URL Mode */}
                {connectionMode === 'url' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      PostgreSQL Connection URL
                    </label>
                    <input
                      type="text"
                      value={dbUrl}
                      onChange={(e) => setDbUrl(e.target.value)}
                      placeholder="postgres://user:password@hostname:5432/dbname"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                    />
                    <div className="bg-neutral-950/50 border border-neutral-800/40 rounded-xl p-3.5 mt-2">
                      <p className="text-xs text-neutral-500 font-semibold mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                        <Info className="w-3.5 h-3.5 text-neutral-600" />
                        URL Standard format
                      </p>
                      <code className="text-xs text-neutral-600 font-mono break-all block">
                        postgres://username:password@host:port/database?sslmode=require
                      </code>
                    </div>
                  </div>
                )}

                {/* Details Mode */}
                {connectionMode === 'details' && (
                  <div className="space-y-4">
                    {/* Host + Port row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Host</label>
                        <input
                          type="text"
                          value={dbHost}
                          onChange={(e) => setDbHost(e.target.value)}
                          placeholder="localhost or db.example.com"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Port</label>
                        <input
                          type="text"
                          value={dbPort}
                          onChange={(e) => setDbPort(e.target.value)}
                          placeholder="5432"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Username</label>
                      <input
                        type="text"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        placeholder="postgres"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={dbPassword}
                          onChange={(e) => setDbPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 pr-10 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Database + SSL */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Database</label>
                        <input
                          type="text"
                          value={dbName}
                          onChange={(e) => setDbName(e.target.value)}
                          placeholder="postgres"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">SSL Mode</label>
                        <div className="relative">
                          <select
                            value={dbSslMode}
                            onChange={(e) => setDbSslMode(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                          >
                            <option value="disable">disable</option>
                            <option value="allow">allow</option>
                            <option value="prefer">prefer</option>
                            <option value="require">require</option>
                            <option value="verify-ca">verify-ca</option>
                            <option value="verify-full">verify-full</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                            ▼
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* URL Preview */}
                    {previewUrl && (
                      <div className="bg-neutral-950/50 border border-neutral-800/40 rounded-xl p-3 flex items-start gap-2">
                        <Link2 className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                        <code className="text-xs text-neutral-500 font-mono break-all leading-relaxed">{previewUrl}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* Connect Button */}
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !canConnect}
                  className="mt-5 w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-600/30 disabled:to-indigo-600/30 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  {isConnecting ? 'Connecting & Inspecting...' : 'Connect & Inspect Database'}
                </button>

                <p className="text-xs text-neutral-500 mt-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-neutral-600" />
                  Credentials are encrypted and processed in server RAM memory only.
                </p>

                {connectionError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                  >
                    <p className="text-sm text-red-400 font-semibold flex items-center gap-2">
                      ⚠️ Connection Failure
                    </p>
                    <p className="text-xs text-red-300 mt-1 font-mono break-all whitespace-pre-wrap">{connectionError}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Export Section (only visible when connected) */}
            <AnimatePresence>
              {tables && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 shadow-xl shadow-black/50"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2.5">
                      <Download className="w-5 h-5 text-emerald-400" />
                      Backup & Export
                    </h2>
                    {serverVersion && (
                      <span className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 px-3 py-1 rounded-lg">
                        PG Server {serverVersion}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 mb-6">
                    <button
                      onClick={() => handleExport('sql')}
                      disabled={isExporting}
                      className="p-4 bg-neutral-950/80 border border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FileCode className="w-6 h-6 text-emerald-400 mb-2.5 group-hover:scale-110 transition-transform" />
                      <h3 className="text-sm font-semibold text-neutral-200">Plain SQL (.sql)</h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">Universal plain SQL. Best for small schema exports.</p>
                    </button>

                    <button
                      onClick={() => handleExport('dump')}
                      disabled={isExporting}
                      className="p-4 bg-neutral-950/80 border border-neutral-800 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <HardDrive className="w-6 h-6 text-blue-400 mb-2.5 group-hover:scale-110 transition-transform" />
                      <h3 className="text-sm font-semibold text-neutral-200">Custom Dump (.dump)</h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">Compressed binary. Best for pg_restore recovery.</p>
                    </button>

                    <button
                      onClick={() => handleExport('tar')}
                      disabled={isExporting}
                      className="p-4 bg-neutral-950/80 border border-neutral-800 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FileArchive className="w-6 h-6 text-purple-400 mb-2.5 group-hover:scale-110 transition-transform" />
                      <h3 className="text-sm font-semibold text-neutral-200">Tar Archive (.tar)</h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">Structured tar archive. Easy to unpack locally.</p>
                    </button>

                    <button
                      onClick={() => handleExport('directory')}
                      disabled={isExporting}
                      className="p-4 bg-neutral-950/80 border border-neutral-800 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Archive className="w-6 h-6 text-amber-400 mb-2.5 group-hover:scale-110 transition-transform" />
                      <h3 className="text-sm font-semibold text-neutral-200">Directory (.zip)</h3>
                      <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">Zipped database directory. Standard backup folder.</p>
                    </button>
                  </div>

                  {isExporting && (
                    <motion.div 
                      layout
                      className="flex items-center gap-3.5 p-4.5 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                    >
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                      <p className="text-xs text-blue-300 font-medium">{exportProgress}</p>
                    </motion.div>
                  )}

                  {!isExporting && exportProgress && (
                    <motion.div 
                      layout
                      className="flex items-center gap-3.5 p-4.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-300 font-medium">{exportProgress}</p>
                    </motion.div>
                  )}

                  {exportNote && (
                    <motion.div 
                      layout
                      className="mt-3.5 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in"
                    >
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300 leading-relaxed">{exportNote}</p>
                    </motion.div>
                  )}

                  {exportError && (
                    <motion.div 
                      layout
                      className="mt-3.5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                    >
                      <p className="text-xs text-red-400 font-semibold mb-1">Export Error</p>
                      <p className="text-xs text-red-300 leading-relaxed font-mono">{exportError}</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bash Script Fallback */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              whileHover={{ opacity: 1 }}
              className="bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl shadow-black/30"
            >
              <div className="bg-neutral-950/60 border-b border-neutral-800/80 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Automated Backup Shell Script</h3>
                </div>
                <button
                  onClick={() => handleCopy(nativeScript, 'native')}
                  className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  {copiedScript === 'native' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript === 'native' ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <div className="p-4 overflow-x-auto custom-scrollbar max-h-64">
                <pre className="text-xs font-mono text-neutral-400 leading-relaxed">
                  <code>{nativeScript}</code>
                </pre>
              </div>
            </motion.div>
          </div>

          {/* ═══ Right Column: Database Inspection (lg:col-span-7) ═══ */}
          <div className="lg:col-span-7 h-full">
            <AnimatePresence mode="wait">
              {tables === null && !isConnecting && !connectionError && (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-neutral-900/40 border border-neutral-800/60 border-dashed rounded-2xl p-16 text-center flex flex-col items-center justify-center min-h-[600px] h-full"
                >
                  <div className="w-16 h-16 bg-neutral-950 border border-neutral-800/50 rounded-2xl flex items-center justify-center mb-6">
                    <Database className="w-8 h-8 text-neutral-600" />
                  </div>
                  <h3 className="text-neutral-300 font-semibold text-lg mb-2">Connect to your Database</h3>
                  <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
                    Provide the host details or connection URL on the left panel. You can inspect tables, search schema, and preview rows in real-time.
                  </p>
                </motion.div>
              )}

              {isConnecting && (
                <motion.div 
                  key="connecting-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-16 text-center flex flex-col items-center justify-center min-h-[600px] h-full"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-blue-400 font-semibold text-lg">Inspecting database catalog...</h3>
                  <p className="text-sm text-neutral-500 mt-2">Connecting and fetching schema catalog structure.</p>
                </motion.div>
              )}

              {tables !== null && (
                <motion.div 
                  key="tables-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl shadow-black/50 flex flex-col h-[740px] max-h-[740px]"
                >
                  {selectedTable ? (
                    /* ─── Table Records View ─── */
                    <div className="flex flex-col h-full">
                      <div className="bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800/80 p-4 sticky top-0 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setSelectedTable(null)} 
                            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-5 h-5 text-neutral-400" />
                          </button>
                          <div className="min-w-0">
                            <h2 className="text-base font-semibold text-white font-mono truncate flex items-center gap-2">
                              <Layers className="w-4 h-4 text-blue-400" />
                              {selectedTable}
                            </h2>
                            <p className="text-xs text-neutral-400">{tableData?.totalCount !== undefined ? `${tableData.totalCount.toLocaleString()} rows` : 'Calculating...'}</p>
                          </div>
                        </div>

                        {/* Search in data */}
                        {tableData && tableData.rows.length > 0 && (
                          <div className="relative max-w-xs w-48 sm:w-64">
                            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={dataSearch}
                              onChange={(e) => setDataSearch(e.target.value)}
                              placeholder="Filter records..."
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-neutral-950">
                        <AnimatePresence mode="wait">
                          {isFetchingData ? (
                            <motion.div 
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col justify-center items-center h-full"
                            >
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                              <span className="text-xs text-neutral-500 font-medium">Fetching table records...</span>
                            </motion.div>
                          ) : dataError ? (
                            <motion.div 
                              key="error"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-6"
                            >
                              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-sm text-red-400 font-semibold">Error retrieving records</p>
                                <p className="text-xs text-red-300 mt-1 break-words font-mono">{dataError}</p>
                              </div>
                            </motion.div>
                          ) : tableData && tableData.rows.length === 0 ? (
                            <div className="flex justify-center items-center h-full text-neutral-500 text-sm">
                              Table is empty
                            </div>
                          ) : tableData ? (
                            /* Records Table */
                            <motion.div 
                              key="table"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="w-full"
                            >
                              <table className="w-full text-left border-collapse text-xs whitespace-nowrap table-fixed">
                                <thead className="bg-neutral-900 sticky top-0 shadow-sm z-10">
                                  <tr>
                                    {tableData.columns.map((c, i) => (
                                      <th key={i} className="px-4.5 py-3.5 border-b border-neutral-800 font-semibold text-neutral-400 font-mono text-[11px] tracking-wider uppercase bg-neutral-900/90 w-48 min-w-48 max-w-48 truncate">
                                        {c.name}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {tableData.rows
                                    .filter(row => {
                                      if (!dataSearch) return true;
                                      return Object.values(row).some(val => 
                                        String(val).toLowerCase().includes(dataSearch.toLowerCase())
                                      );
                                    })
                                    .map((row, i) => (
                                      <tr key={i} className="hover:bg-neutral-900/30 transition-colors">
                                        {tableData.columns.map((c, j) => (
                                          <td key={j} className="px-4.5 py-2.5 text-neutral-300 font-mono text-[11px] truncate w-48 max-w-48" title={String(row[c.name])}>
                                            {row[c.name] === null ? (
                                              <span className="text-neutral-700 italic">null</span>
                                            ) : (
                                              String(row[c.name])
                                            )}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      {tableData && tableData.totalCount > 50 && (
                        <div className="bg-neutral-950 border-t border-neutral-900/80 p-3.5 flex items-center justify-between shrink-0">
                          <span className="text-xs text-neutral-500 font-medium">
                            Showing {page * 50 + 1} - {Math.min((page + 1) * 50, tableData.totalCount)} of {tableData.totalCount.toLocaleString()} rows
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => loadMoreData('prev')}
                              disabled={page === 0 || isFetchingData}
                              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-xs text-neutral-300 transition-all font-semibold cursor-pointer"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => loadMoreData('next')}
                              disabled={(page + 1) * 50 >= tableData.totalCount || isFetchingData}
                              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-xs text-neutral-300 transition-all font-semibold cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ─── Tables Catalog View ─── */
                    <>
                      <div className="bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800/80 p-4 sticky top-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500/10 rounded-xl">
                            <Table className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h2 className="text-base font-semibold text-white">Database Catalog</h2>
                            <p className="text-xs text-neutral-400">{tables.length} tables in public schema</p>
                          </div>
                        </div>
                        
                        {/* Table filter search bar */}
                        <div className="relative">
                          <Filter className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="Filter tables..."
                            className="bg-neutral-900 border border-neutral-850 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-48"
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto p-4 flex-1 custom-scrollbar bg-neutral-950/20">
                        {filteredTables.length === 0 ? (
                          <div className="text-center py-16">
                            <p className="text-neutral-500 text-sm">No matching tables found.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {filteredTables.map((table, i) => (
                              <motion.button
                                key={table.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
                                onClick={() => handleTableClick(table.name)}
                                className="w-full flex items-center justify-between p-4.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group cursor-pointer shadow-sm"
                              >
                                <div className="flex items-center gap-3.5 truncate">
                                  <div className="p-2 bg-neutral-950 border border-neutral-850 rounded-lg group-hover:border-blue-500/30 transition-colors">
                                    <Database className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 transition-colors shrink-0" />
                                  </div>
                                  <span className="text-sm font-semibold text-neutral-200 font-mono truncate group-hover:text-white transition-colors">{table.name}</span>
                                </div>
                                <div className="px-3 py-1.5 bg-neutral-950 border border-neutral-850 rounded-lg shrink-0 ml-4 group-hover:bg-neutral-900 transition-all">
                                  <span className="text-xs text-neutral-400 font-semibold font-mono">
                                    {table.rows === -1 ? 'Unknown' : `${table.rows.toLocaleString()}`}
                                  </span>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ─── LIVE MIGRATION MODAL ─── */}
      <AnimatePresence>
        {showMigrationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <div className="bg-neutral-950 border-b border-neutral-800 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="w-5 h-5 text-purple-400 animate-pulse" />
                  <div>
                    <h3 className="text-base font-bold text-white">Live Postgres Migration</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Move tables, schemas, constraints, and data directly</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMigrationModal(false)}
                  className="text-neutral-500 hover:text-white text-lg font-bold px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Source Database Display */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Source DB</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300 font-semibold truncate max-w-xs">{scriptTargetUrl}</span>
                </div>

                <div className="h-[1px] bg-neutral-800"></div>

                {/* Target Database Form */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Destination Database Configuration</h4>
                  
                  {/* Mode Toggles */}
                  <div className="flex bg-neutral-950 border border-neutral-850 rounded-xl p-1">
                    <button
                      onClick={() => setMigTargetConnectionMode('url')}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        migTargetConnectionMode === 'url' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Connection URL
                    </button>
                    <button
                      onClick={() => setMigTargetConnectionMode('details')}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        migTargetConnectionMode === 'details' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Parameters
                    </button>
                  </div>

                  {migTargetConnectionMode === 'url' ? (
                    <div>
                      <input
                        type="text"
                        value={migTargetUrl}
                        onChange={(e) => setMigTargetUrl(e.target.value)}
                        placeholder="postgres://user:password@dest-host:5432/dest-db"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4.5 py-3 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={migTargetHost}
                            onChange={(e) => setMigTargetHost(e.target.value)}
                            placeholder="Hostname (e.g. localhost)"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <input
                          type="text"
                          value={migTargetPort}
                          onChange={(e) => setMigTargetPort(e.target.value)}
                          placeholder="5432"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={migTargetUser}
                          onChange={(e) => setMigTargetUser(e.target.value)}
                          placeholder="Username"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <input
                          type="password"
                          value={migTargetPassword}
                          onChange={(e) => setMigTargetPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={migTargetName}
                          onChange={(e) => setMigTargetName(e.target.value)}
                          placeholder="Database Name"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <select
                          value={migTargetSslMode}
                          onChange={(e) => setMigTargetSslMode(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="disable">disable</option>
                          <option value="allow">allow</option>
                          <option value="prefer">prefer</option>
                          <option value="require">require</option>
                        </select>
                      </div>
                      {destPreviewUrl && (
                        <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-2.5 text-[10px] text-neutral-500 font-mono break-all leading-normal">
                          {destPreviewUrl}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {migrationError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                    {migrationError}
                  </div>
                )}

                {migrationSuccess && (
                  <div className="p-4.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold flex items-center gap-2">
                    ✅ Migration completed successfully! All tables and data have been copied to the destination database.
                  </div>
                )}

                {destTestError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono">
                    ❌ Destination connection test failed: {destTestError}
                  </div>
                )}

                {destTestSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold">
                    ✅ Destination connection test successful! Ready to migrate.
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingDest || !canMigrate}
                    className="col-span-1 py-4 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {isTestingDest ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Test Link
                  </button>
                  <button
                    onClick={handleMigration}
                    disabled={isMigrating || !canMigrate}
                    className="col-span-2 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-600/30 disabled:to-indigo-600/30 disabled:text-neutral-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-purple-500/10 text-xs"
                  >
                    {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    {isMigrating ? 'Migrating...' : 'Start Migration'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom scrollbar styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
          border-radius: 10px;
        }
      ` }} />
    </div>
  );
}