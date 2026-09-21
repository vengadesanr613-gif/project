$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlExe = Join-Path $projectRoot "tools\mysql-9.6.0-winx64\bin\mysqladmin.exe"

& $mysqlExe -u root -proot shutdown
