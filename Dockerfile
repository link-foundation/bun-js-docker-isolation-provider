FROM oven/bun:latest

COPY package.json ./
COPY bun.lockb ./
COPY src ./

RUN bun install

# Set the entrypoint to use the 'bun' command and run the 'index.js' file
ENTRYPOINT ["bun", "index.ts"]