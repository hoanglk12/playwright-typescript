FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Install Playwright browsers (ensuring latest versions)
RUN npx playwright install

# Create necessary directories
RUN mkdir -p test-results playwright-report api-results api-report logs

# Set permissions
RUN chmod -R 755 test-results playwright-report api-results api-report logs

# Expose port for debugging (optional)
EXPOSE 9323

# Default command
CMD ["npm", "run", "test"]