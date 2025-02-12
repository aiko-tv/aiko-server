FROM oven/bun:1

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies explicitly with Bun
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Set Railway environment variables
ENV PORT=6969

# Expose ports
EXPOSE 6969
EXPOSE 8080

# Start the application with Bun
CMD ["bun", "run", "start"]
