FROM alpine:latest

# Install required tools
RUN apk add --no-cache \
    curl \
    certbot \
    certbot-nginx \
    openssl \
    bash

# Create directories
RUN mkdir -p /ssl/certs /ssl/webroot /scripts

# Copy initialization script
COPY init-ssl.sh /scripts/init-ssl.sh
RUN chmod +x /scripts/init-ssl.sh

# Set working directory
WORKDIR /scripts

# Default command
CMD ["./init-ssl.sh"] 