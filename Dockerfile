# Use a Debian-based slim Node image for compatibility and smaller size
FROM node:20-bookworm-slim

# Install dependencies including LibreOffice and font libraries for high-fidelity conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory inside the container
WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install all npm dependencies (includes devDependencies for the Vite build phase)
RUN npm ci

# Copy all project source code
COPY . .

# Build the React + Vite production frontend assets (creates the /dist directory)
RUN npm run build

# Configure production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the application port (Koyeb maps this automatically)
EXPOSE 8080

# Launch the production Express server
CMD ["node", "server/index.js"]
