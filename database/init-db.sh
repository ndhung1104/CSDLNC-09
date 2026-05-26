#!/usr/bin/env bash
set -euo pipefail

/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$DB_PASSWORD" -d master -i /scripts/schema.sql -C
/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$DB_PASSWORD" -d PETCAREX -i /scripts/routines.sql -C
/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$DB_PASSWORD" -d PETCAREX -i /scripts/seed.sql -C

printf '%s\n' "Database initialization completed."
