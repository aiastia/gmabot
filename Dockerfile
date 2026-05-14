FROM nginx:alpine

# 复制游戏文件到 nginx 静态目录
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# nginx 配置 - 支持中文文件名和缓存
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    charset utf-8; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # 静态资源缓存 \
    location ~* \.(js|css|png|jpg|ico)$ { \
        expires 1h; \
        add_header Cache-Control "public, must-revalidate"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]