FROM oven/bun:1

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 6969
EXPOSE 8080

CMD ["bun", "start"]
