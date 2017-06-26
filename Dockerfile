FROM node:7.10.0

ADD ./app /src/app

WORKDIR /src/app
RUN npm install

EXPOSE 3000

CMD NODE_ENV=production node bin/www