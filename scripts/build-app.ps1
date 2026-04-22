$projectRoot = Split-Path -Parent $PSScriptRoot
$maven = Join-Path $projectRoot "tools\apache-maven-3.9.15\bin\mvn.cmd"

$env:MAVEN_OPTS = "-Duser.home=`"$projectRoot`""

& $maven clean package
