# Базовый образ Nginx на Alpine
FROM nginx:1.27.2-alpine

# Устанавливаем Certbot и необходимые пакеты
RUN apk update && \
    apk add --no-cache certbot bash curl openssl && \
    mkdir -p /var/www/certbot /etc/letsencrypt
# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем скрипт для обновления сертификатов
COPY renew.sh /etc/periodic/daily/certbot-renew

# Делаем скрипт исполняемым
RUN chmod +x /etc/periodic/daily/certbot-renew

RUN certbot certonly --webroot -w /var/www/certbot -d elusha.ru -d www.elusha.ru --email andrewanderson@mail.ru --agree-tos --noninteractive

# Запускаем cron и Nginx
CMD crond -f -d 8 & nginx -g "daemon off;"