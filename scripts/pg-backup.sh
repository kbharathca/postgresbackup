#!/bin/bash
# Script to backup a PostgreSQL database using a connection string URL

# Check if URL is provided
if [ -z "$1" ]; then
    echo "Usage: ./pg-backup.sh \"postgres://user:password@host:port/dbname\" [output_file.sql]"
    echo ""
    echo "Example:"
    echo "  ./pg-backup.sh \"postgres://myuser:mypass@localhost:5432/mydb\" my_backup.sql"
    exit 1
fi

DB_URL=$1
# Default filename with timestamp if not provided
OUTPUT_FILE=${2:-"db_backup_$(date +%Y%m%d_%H%M%S).sql"}

echo "Connecting to database and starting backup..."
echo "Saving to: $OUTPUT_FILE"

# Run pg_dump (requires postgresql-client installed on your machine)
pg_dump "$DB_URL" --clean --if-exists --no-owner --no-privileges > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully: $OUTPUT_FILE"
else
    echo "❌ Error: pg_dump failed. Make sure postgresql-client is installed and the URL is correct."
    exit 1
fi
