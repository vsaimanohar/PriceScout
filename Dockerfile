# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json from root (our proxy file)
COPY package.json ./

# Copy backend directory
COPY backend/ ./backend/

# Install dependencies (will run "cd backend && npm install")
RUN npm install

# Expose port
EXPOSE 3000

# Start the application (will run "cd backend && npm start")
CMD ["npm", "start"]