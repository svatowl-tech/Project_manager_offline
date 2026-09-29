@echo off
chcp 65001 >nul
title СУП Руководителя Направления (SMB Workspace)

echo ===================================================================
echo   СИСТЕМА УПРАВЛЕНИЯ РУКОВОДИТЕЛЯ НАПРАВЛЕНИЯ (СУП SMB)
echo   Запуск в защищенном локальном контексте (Secure Context: 127.0.0.1)
echo   Поддержка File System Access API для работы с сетевыми папками SMB
echo ===================================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "PORT=8080"

:: Запуск встроенного легковесного HTTP-сервера через стандартный PowerShell (.NET HttpListener)
:: Это гарантирует Secure Context (http://127.0.0.1) и полную доступность window.showDirectoryPicker()
echo [1/2] Инициализация локального защищенного хоста 127.0.0.1:%PORT%...

start /b powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 8080; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://127.0.0.1:' + $port + '/'); $listener.Start(); while ($listener.IsListening) { try { $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response; $path = '.' + [System.Web.HttpUtility]::UrlDecode($req.Url.AbsolutePath); if ($path -eq './' -or $path -eq '.') { $path = './index.html' }; if (Test-Path $path) { $bytes = [System.IO.File]::ReadAllBytes($path); $ext = [System.IO.Path]::GetExtension($path).ToLower(); if ($ext -eq '.html') { $res.ContentType = 'text/html; charset=utf-8' } elseif ($ext -eq '.js') { $res.ContentType = 'application/javascript; charset=utf-8' } elseif ($ext -eq '.css') { $res.ContentType = 'text/css; charset=utf-8' } elseif ($ext -eq '.json') { $res.ContentType = 'application/json' } elseif ($ext -eq '.wasm') { $res.ContentType = 'application/wasm' } else { $res.ContentType = 'application/octet-stream' }; $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close(); } else { $res.StatusCode = 404; $res.Close(); } } catch {} }" >nul 2>&1

timeout /t 1 /nobreak >nul

:: Поиск установленного Chromium-браузера
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Yandex\YandexBrowser\Application\browser.exe" (
    set "BROWSER=%LOCALAPPDATA%\Yandex\YandexBrowser\Application\browser.exe"
)

echo [2/2] Запуск корпоративного окна руководителя...

if defined BROWSER (
    start "" "%BROWSER%" --app="http://127.0.0.1:%PORT%" --no-first-run
) else (
    start "" "http://127.0.0.1:%PORT%"
)

echo [OK] Приложение успешно запущено. Не закрывайте это окно во время работы.
exit /b 0
