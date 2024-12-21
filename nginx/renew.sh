#!/bin/sh

# Получение сертификатов для домена
certbot certonly --webroot -w /var/www/certbot -d elusha.ru -d www.elusha.ru --email andrewanderson@mai.ru --agree-tos --noninteractive

# Перезагрузка Nginx после обновления сертификатов
nginx -s reload
