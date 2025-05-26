# CloudWorx-WApp
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](https://www.javascript.com)
[![Sass](https://img.shields.io/badge/Sass-C69?logo=sass&logoColor=fff)](https://sass-lang.com)

HTML/JS web client for [CloudWorx](https://github.com/Nanda128/CloudWorx-Backend) project.

<p align="center">
    <img alt="Home Page Screenshot" src="./docs/img/png/home.png" />
    <br />
    CloudWorx Website Home Page
</p>

## Setup Steps
Follow steps 1, 2, and 3 below to setup and run the app.

## 1. Environment Setup
1. Copy `.env.example` to `.env`.
2. Contact [darragh0](https://github.com/darragh0) for the actual values and replace the placeholders with them.

### 2. Configuring Certificates
This web client is set up using [Express.js](https://expressjs.com) and is configured to run on HTTPS (see [Why HTTPS?](#why-https)). To ensure your browser accepts the secure connection, we need to generate and trust local TLS certificates for the app.

The following commands show how to do this using [`mkcert`](https://github.com/FiloSottile/mkcert), but you can use a different tool if you prefer.

> You can install `mkcert` using [`chocolatey`](https://chocolatey.org/) or some other package manager. To install using `chocolatey`, run the following in an elevated shell (e.g. Powershell in admin mode).
> ```sh
> > choco install mkcert
> ```
>
> You can then set up trust on your machine by running the following command, which installs mkcert's local root CA certificate in into your system's and browsers' trusted root certificate stores. 
> ```sh
> > mkcert -install
> ```
>
> After that, run the following command to generate the key and cert in a new `certs` directory:
> ```sh
> > mkdir certs && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost
> ```
>

### 3. Running the App
Assuming you have [Node.js](https://nodejs.org/en) installed, you can install the dependencies and run the app using the following command:
```sh
> npm install && npm run serve
```
Then simply open [`localhost:3443`](https://localhost:3443) in your browser.

> [!NOTE]
> Your browser may throw a "Potential Security Risk Ahead" warning (or similar) when visiting the website. If this doesn't go away after restarting your browser, it can safely be ignored.

## Why HTTPS?
The web client requires certain [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) APIs such as [`crypto.subtle`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle), which only works in **secure contexts** (HTTPS).
