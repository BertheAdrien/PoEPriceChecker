@echo off
rem Lance PoE Price Checker en local : http://localhost:3030
rem Prerequis : Node.js 24 ou plus (https://nodejs.org). Git est optionnel (sert aux mises a jour).
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title PoE Price Checker
set "PORT=3030"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable. Installe la version LTS ^(24 ou plus^) depuis https://nodejs.org puis relance ce fichier.
  start "" https://nodejs.org
  goto :fail
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 24 (
  echo [ERREUR] Node.js %NODE_MAJOR% detecte, il faut la version 24 ou plus : https://nodejs.org
  goto :fail
)

rem Mise a jour automatique si le dossier a ete recupere avec git clone
set "REV=no-git"
if exist ".git" (
  where git >nul 2>&1
  if not errorlevel 1 (
    echo Recherche de mises a jour...
    git pull --ff-only --quiet
    for /f %%r in ('git rev-parse HEAD') do set "REV=%%r"
  )
)

rem (Re)installation et compilation au premier lancement ou apres une mise a jour
set "BUILT_REV="
if exist ".next\launcher-rev.txt" set /p BUILT_REV=<".next\launcher-rev.txt"
if exist ".next\BUILD_ID" if "%BUILT_REV%"=="%REV%" goto :start

echo Installation des dependances (quelques minutes la premiere fois)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
echo Compilation de l'application...
call npm run build
if errorlevel 1 goto :fail
>".next\launcher-rev.txt" echo %REV%

:start
echo.
echo PoE Price Checker demarre sur http://localhost:%PORT%
echo Laisse cette fenetre ouverte ; ferme-la pour arreter l'application.
echo.
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:%PORT%"
call npm run start -- -p %PORT%
goto :eof

:fail
echo.
echo Le lancement a echoue (voir le message ci-dessus).
pause
exit /b 1
