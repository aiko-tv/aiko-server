FROM oven/bun:1

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json ./

# Install dependencies and generate lockfile
RUN bun install

# Copy the rest of the application
COPY . .

# Set Railway environment variables
ENV PORT=6969

# Expose ports
EXPOSE 6969
EXPOSE 8080

# Start the application with Bun
CMD ["bun", "run", "start"]
