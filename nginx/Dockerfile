# Базовый образ Nginx на Alpine
FROM nginx:1.27.2-alpine

# Устанавливаем Certbot и необходимые пакеты
RUN apk update && \
    apk add --no-cache certbot bash curl openssl mc cron supervisor && \
    mkdir -p /var/www/certbot /etc/letsencrypt
# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем скрипт для обновления сертификатов
COPY renew.sh /etc/periodic/daily/renew.sh
COPY crond_nginx.conf /etc/supervisor/conf.d/crond_nginx.conf

# Делаем скрипт исполняемым
RUN chmod +x /etc/periodic/daily/renew.sh
RUN echo "0 0 */80 * * /etc/periodic/daily/renew.sh >> /var/log/renew.log 2>&1" | crontab -
RUN certbot certonly --webroot -w /var/www/certbot -d elusha.ru -d www.elusha.ru --email andrewanderson@mai.ru --agree-tos --noninteractive

# Запускаем cron и Nginx
CMD supervisord -c /etc/supervisor/supervisord.conf
