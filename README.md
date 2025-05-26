# CloudWorx-WApp
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](https://www.javascript.com)
[![Sass](https://img.shields.io/badge/Sass-C69?logo=sass&logoColor=fff)](https://sass-lang.com)

HTML/JS web client for [CloudWorx](https://github.com/Nanda128/CloudWorx-Backend) project.

<p align="center">
    <img alt="Home Page Screenshot" src="./docs/img/png/home.png" />
    <br />
    CloudWorx Website Home Page
</p>

## Running The App
This web client is set up using [Express.js](https://expressjs.com). Assuming you have [Node.js](https://nodejs.org/en) installed, you can install the dependencies and run the app using the following command:
```sh
> npm install && npm run serve
```

Then simply navigate to [`localhost:3443`](https://localhost:3443).

## Environment Variables
This application uses environment variables for configuration. Create a `.env` file in the root directory with the following variables:

```
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
```

You can use the `.env.example` file as a template.

<!--
## Removing "Security Risk" Warning
The web client requires certain [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) APIs such as [`crypto.subtle`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle), which only work on **secure contexts** (HTTPS). To run the app using HTTPS, we need trusted certificates.

Your browser may throw a "Potential Security Risk Ahead" warning (or similar) when visiting the website—meaning your browser 
-->