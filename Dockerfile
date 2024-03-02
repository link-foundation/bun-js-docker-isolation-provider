FROM oven/bun:latest

COPY package.json ./
COPY bun.lockb ./
COPY src ./

RUN bun install

# Copy the necessary files into the container
COPY package.json .
COPY index.ts .
COPY node_modules ./node_modules
COPY imports/eval.ts ./imports/eval.ts

# Set the entrypoint to use the 'bun' command and run the 'index.js' file
ENTRYPOINT ["bun", "index.ts"]