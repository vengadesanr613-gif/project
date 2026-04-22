$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlHome = Join-Path $projectRoot "tools\mysql-9.6.0-winx64"
$mysqlBin = Join-Path $mysqlHome "bin"
$defaultsFile = Join-Path $mysqlHome "my.ini"
$dataDir = Join-Path $mysqlHome "data"
$outLogFile = Join-Path $mysqlHome "mysql-start.log"
$errLogFile = Join-Path $mysqlHome "mysql-error.log"
$schemaFile = Join-Path $projectRoot "src\main\resources\database.sql"
$defaultsArg = "--defaults-file=`"$defaultsFile`""

if (!(Test-Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}

if (!(Test-Path (Join-Path $dataDir "mysql"))) {
    & (Join-Path $mysqlBin "mysqld.exe") $defaultsArg --initialize-insecure
}

$existing = Get-Process mysqld -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "MySQL is already running."
    exit 0
}

Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") `
    -ArgumentList $defaultsArg `
    -RedirectStandardOutput $outLogFile `
    -RedirectStandardError $errLogFile

Start-Sleep -Seconds 8

& (Join-Path $mysqlBin "mysql.exe") -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root';" 2>$null
(Get-Content $schemaFile -Raw) | & (Join-Path $mysqlBin "mysql.exe") -u root -proot

Write-Output "MySQL started. Root password is set to root."
