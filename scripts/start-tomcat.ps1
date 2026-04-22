$projectRoot = Split-Path -Parent $PSScriptRoot
$tomcatBin = Join-Path $projectRoot "tools\apache-tomcat-10.1.54\bin"
$env:JRE_HOME = "D:\Program Files"
$env:JAVA_HOME = "D:\Program Files"

Push-Location $tomcatBin
try {
    & ".\startup.bat"
} finally {
    Pop-Location
}
