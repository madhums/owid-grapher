FROM node:10.12.0-alpine

# add bash
RUN apk update
RUN apk upgrade
RUN apk add bash
RUN apk add yarn
RUN apk add --no-cache --virtual .gyp python make g++ 
RUN apk add vips-dev fftw-dev build-base --update-cache \
    --repository https://alpine.global.ssl.fastly.net/alpine/edge/testing/ \
    --repository https://alpine.global.ssl.fastly.net/alpine/edge/main

WORKDIR /app
# https://stackoverflow.com/a/32785014/232619
COPY . /app 
RUN yarn
RUN npm i -g typeorm
COPY docker/wait-for-it.sh /usr/local
RUN chmod +x /usr/local/wait-for-it.sh

EXPOSE 3030
EXPOSE 8090

CMD ["yarn", "dev"]