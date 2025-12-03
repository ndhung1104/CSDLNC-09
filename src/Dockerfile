FROM node:20-alpine

WORKDIR /app

# Install dependencies (include dev for nodemon)
COPY src/package*.json ./
RUN npm install

# Copy application source
COPY src/ .

EXPOSE 54321

# Use nodemon for hot reloading in development
CMD ["npm", "start"]
