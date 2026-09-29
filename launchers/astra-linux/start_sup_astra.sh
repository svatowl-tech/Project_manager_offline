#!/bin/bash
# ===================================================================
#   СИСТЕМА УПРАВЛЕНИЯ РУКОВОДИТЕЛЯ НАПРАВЛЕНИЯ (СУП SMB)
#   Автономный запуск в защищенном контуре Astra Linux (Secure Context)
# ===================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8080

echo "==================================================================="
echo "  Инициализация СУП Руководителя в защищенном контуре..."
echo "  Хост: http://127.0.0.1:$PORT (Secure Context для File System Access API)"
echo "==================================================================="

# Запуск встроенного легковесного HTTP сервера Python (предустановлен в Astra Linux)
if command -v python3 >/dev/null 2>&1; then
    python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
    SERVER_PID=$!
elif command -v python >/dev/null 2>&1; then
    python -m SimpleHTTPServer "$PORT" >/dev/null 2>&1 &
    SERVER_PID=$!
fi

sleep 1

# Поиск браузеров на базе Chromium в Astra Linux / Debian / РЕД ОС
BROWSER=""
if command -v chromium-gost >/dev/null 2>&1; then
    BROWSER="chromium-gost"
elif command -v chromium-browser >/dev/null 2>&1; then
    BROWSER="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
    BROWSER="chromium"
elif command -v google-chrome >/dev/null 2>&1; then
    BROWSER="google-chrome"
elif command -v yandex-browser >/dev/null 2>&1; then
    BROWSER="yandex-browser"
elif command -v astra-browser >/dev/null 2>&1; then
    BROWSER="astra-browser"
elif command -v xdg-open >/dev/null 2>&1; then
    BROWSER="xdg-open"
fi

TARGET_URL="http://127.0.0.1:$PORT"

if [ -n "$BROWSER" ] && [ "$BROWSER" != "xdg-open" ]; then
    echo "[OK] Открытие отдельного окна через $BROWSER..."
    "$BROWSER" --app="$TARGET_URL" \
               --no-first-run \
               --no-default-browser-check >/dev/null 2>&1 &
else
    echo "[INFO] Открытие в системном браузере..."
    xdg-open "$TARGET_URL" >/dev/null 2>&1 &
fi

exit 0
