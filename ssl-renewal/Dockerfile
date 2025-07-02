FROM alpine:latest

# Install required tools
RUN apk add --no-cache \
    certbot \
    openssl \
    bash \
    curl

# Create directories
RUN mkdir -p /scripts

# Copy renewal script
COPY renew-ssl.sh /scripts/renew-ssl.sh
RUN chmod +x /scripts/renew-ssl.sh

# Set working directory
WORKDIR /scripts

# Default command - run renewal check every 12 hours
CMD ["./renew-ssl.sh"] 