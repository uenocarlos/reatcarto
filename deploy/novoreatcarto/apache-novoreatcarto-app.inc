# Shared app config for isolated novoreatcarto vhosts.
# Do not Include this from reatcarto.furg.br or the default site.
ServerAdmin webmaster@localhost
DocumentRoot /var/www/novoreatcarto/dist

Alias /php /var/www/novoreatcarto/php

<IfModule mod_deflate.c>
    <IfModule mod_filter.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript
        AddOutputFilterByType DEFLATE application/javascript application/x-javascript application/ecmascript
        AddOutputFilterByType DEFLATE application/json application/geo+json application/xml
        AddOutputFilterByType DEFLATE image/svg+xml application/wasm
    </IfModule>
</IfModule>

<IfModule mod_brotli.c>
    AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/xml text/css text/javascript
    AddOutputFilterByType BROTLI_COMPRESS application/javascript application/json application/geo+json
    AddOutputFilterByType BROTLI_COMPRESS image/svg+xml application/xml application/wasm
    BrotliCompressionQuality 5
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresDefault "access plus 1 hour"
    ExpiresByType text/html "access plus 0 seconds"
    ExpiresByType application/json "access plus 1 day"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
    Header unset ETag
    FileETag None
    <LocationMatch "^/assets/">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>
    <LocationMatch "^/(icons|export|geo)/">
        Header set Cache-Control "public, max-age=86400"
    </LocationMatch>
    <Files "index.html">
        Header set Cache-Control "no-cache"
    </Files>
</IfModule>

<Directory /var/www/novoreatcarto/dist>
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource /index.html
</Directory>

<Directory /var/www/novoreatcarto/dist/assets>
    FallbackResource disabled
</Directory>

<Directory /var/www/novoreatcarto/dist/icons>
    FallbackResource disabled
</Directory>

<Directory /var/www/novoreatcarto/dist/export>
    FallbackResource disabled
</Directory>

<Directory /var/www/novoreatcarto/dist/geo>
    FallbackResource disabled
</Directory>

<Directory /var/www/novoreatcarto/dist/apk>
    FallbackResource disabled
</Directory>

<Directory /var/www/novoreatcarto/php>
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource disabled
    <FilesMatch "\.php$">
        SetHandler application/x-httpd-php
    </FilesMatch>
</Directory>

<IfModule mod_php.c>
    php_admin_value upload_max_filesize 25M
    php_admin_value post_max_size 30M
    php_admin_value memory_limit 256M
</IfModule>
<IfModule mod_php8.c>
    php_admin_value upload_max_filesize 25M
    php_admin_value post_max_size 30M
    php_admin_value memory_limit 256M
</IfModule>

ErrorLog ${APACHE_LOG_DIR}/novoreatcarto-error.log
CustomLog ${APACHE_LOG_DIR}/novoreatcarto-access.log combined
