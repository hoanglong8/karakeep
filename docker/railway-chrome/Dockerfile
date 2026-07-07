FROM gcr.io/zenika-hub/alpine-chrome:124
USER root
RUN apk add --no-cache nginx
COPY nginx.conf /etc/nginx/nginx.conf
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["chromium-browser --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-port=9223 --remote-allow-origins=* --hide-scrollbars --disable-blink-features=AutomationControlled --window-size=1440,900 & nginx -g 'daemon off;'"]
