# Базовый образ Nginx на Alpine
FROM nginx:1.27.2-alpine

# Устанавливаем Certbot и необходимые пакеты
RUN apk update && \
    apk add --no-cache certbot bash curl openssl mc && \
    mkdir -p /var/www/certbot  && \
    mkdir -p /etc/letsencrypt  && \
    mkdir -p /etc/periodic/daily

# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем скрипт для обновления сертификатов
COPY renew.sh /etc/periodic/daily/renew.sh
RUN chmod +x /etc/periodic/daily/renew.sh

# Добавляем правило в crontab
RUN echo "0 0 */80 * * /etc/periodic/daily/renew.sh >> /var/log/renew.log 2>&1" > /etc/crontabs/root

# Копируем entrypoint.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]

