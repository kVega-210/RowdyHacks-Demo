@echo off
rem One command dev start on Windows (OPS-01). Usage: run.cmd [test|build|bots|smoke|keys|gen-voice] [args]
setlocal
cd /d "%~dp0"
if exist .env for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
set "HEIST_ROOT=%cd%"
if "%1"=="test" (cd server & call mvnw.cmd -B test & exit /b %errorlevel%)
if "%1"=="build" (cd server & call mvnw.cmd -q -B -DskipTests package & exit /b %errorlevel%)
rem Rebuild when the jar is missing or any server source is newer than it (e.g. after git pull).
set "STALE=0"
if not exist server\target\heist-server.jar set "STALE=1"
if "%STALE%"=="0" powershell -NoProfile -Command "$j=(Get-Item 'server\target\heist-server.jar').LastWriteTime; if (Get-ChildItem server\src,server\pom.xml -Recurse -File | Where-Object { $_.LastWriteTime -gt $j } | Select-Object -First 1) { exit 1 }" || set "STALE=1"
if "%STALE%"=="1" (
  echo Building server...
  pushd server & call mvnw.cmd -q -B -DskipTests package & popd
)
java -jar server\target\heist-server.jar %*
