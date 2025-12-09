#!/bin/bash
sleep 10
/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$SA_PASSWORD" -d master -i /scripts/PETCAREX_Script.sql -C
/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$SA_PASSWORD" -d PETCAREX -i /scripts/PETCAREX_Function.sql -C
/opt/mssql-tools18/bin/sqlcmd -S mssql -U sa -P "$SA_PASSWORD" -d PETCAREX -i /scripts/seed_master.sql -C
echo "DB init complete!"
