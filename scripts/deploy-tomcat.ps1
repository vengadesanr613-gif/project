$projectRoot = Split-Path -Parent $PSScriptRoot
$warFile = Join-Path $projectRoot "target\jsp-student-crud.war"
$webapps = Join-Path $projectRoot "tools\apache-tomcat-10.1.54\webapps"

Copy-Item -Path $warFile -Destination $webapps -Force
Write-Output "WAR copied to Tomcat webapps."
