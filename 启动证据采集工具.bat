@echo off
setlocal
chcp 65001 >nul 2>&1
title Picture OCR
cd /d "%~dp0"

rem Release ZIPs have no source tree and do not require Node.js.
if not exist "src\" goto serve

rem Compare file contents so checkout timestamps and deleted files are handled.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; try {" ^
  "$paths = @('src', 'public', 'presets', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', '.env', '.env.local', '.env.production', '.env.production.local', 'scripts/generate-pwa-icons.mjs', 'scripts/generate-service-worker.mjs');" ^
  "$files = @($paths | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-ChildItem -LiteralPath $_ -Recurse -File });" ^
  "$entries = @($files | Sort-Object FullName -Unique | ForEach-Object { $_.FullName.Substring($PWD.Path.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash });" ^
  "$sha = [Security.Cryptography.SHA256]::Create(); try { $hash = [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($entries -join [char]10)))) } finally { $sha.Dispose() };" ^
  "$cache = 'node_modules/.cache/picture-ocr-web-build';" ^
  "if ((Test-Path -LiteralPath 'dist/index.html') -and (Test-Path -LiteralPath 'dist/service-worker.js') -and (Test-Path -LiteralPath ($cache + '.sha256')) -and ((Get-Content -LiteralPath ($cache + '.sha256') -Raw).Trim() -eq $hash)) { exit 0 };" ^
  "New-Item -ItemType Directory -Path 'node_modules/.cache' -Force | Out-Null;" ^
  "Set-Content -LiteralPath ($cache + '.pending') -Value $hash -Encoding ASCII; exit 10" ^
  "} catch { Write-Error $_; exit 1 }"
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
if "%SERVER_EXIT_CODE%"=="10" goto rebuild
if not "%SERVER_EXIT_CODE%"=="0" goto failed
goto serve

:rebuild
echo [INFO] Web build inputs changed or build is missing. Rebuilding...
where npm.cmd >nul 2>&1
if errorlevel 1 (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] npm was not found. Install Node.js or use the prebuilt Web ZIP.
  goto failed
)
if not exist "node_modules\.bin\tsc.cmd" (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] Build dependencies are missing. Run npm ci in this folder first.
  goto failed
)
if not exist "node_modules\.bin\vite.cmd" (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] Build dependencies are missing. Run npm ci in this folder first.
  goto failed
)
call npm.cmd run build
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
if not "%SERVER_EXIT_CODE%"=="0" goto failed
if not exist "dist\service-worker.js" (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] Build did not produce dist\service-worker.js.
  goto failed
)
move /y "node_modules\.cache\picture-ocr-web-build.pending" "node_modules\.cache\picture-ocr-web-build.sha256" >nul
if errorlevel 1 (
  set "SERVER_EXIT_CODE=1"
  goto failed
)

:serve
if not exist "dist\index.html" (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] dist\index.html was not found. Extract the complete release package.
  goto failed
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
if "%SERVER_EXIT_CODE%"=="0" exit /b 0

:failed
echo.
echo [ERROR] Web service stopped or failed. Exit code: %SERVER_EXIT_CODE%
echo [INFO] Read the error shown above before closing this window.
echo.
pause
exit /b %SERVER_EXIT_CODE%
