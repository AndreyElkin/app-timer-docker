#!/bin/bash
set -e

# Запускаем cron
crond -f &

# Запускаем Nginx
nginx -g "daemon off;" &

# Выполняем renew.sh
/etc/periodic/daily/renew.sh

# Ждём завершения всех процессов
wait
