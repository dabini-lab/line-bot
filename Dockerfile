# Use an official Node.js runtime as the base image.
FROM node:18

# Create and set the working directory.
WORKDIR /usr/src/app

# Copy package files and install dependencies.
COPY package*.json ./
RUN npm install

# Copy the rest of the application code.
COPY . .

# Expose the port the app runs on.
EXPOSE 8080

# Start the bot.
CMD ["node", "index.js"]
