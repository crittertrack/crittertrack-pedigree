# Use the official Node.js 20 LTS image as the base
FROM node:20

# Create application directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application source code (index.js, etc.)
COPY . .

# Cloud Run expects the app to listen on the port defined by the PORT environment variable.
# We expose the default port 8080 (though the app will use the $PORT env variable).
ENV PORT 8080
EXPOSE 8080

# Run the Node.js server
CMD [ "npm", "start" ]
