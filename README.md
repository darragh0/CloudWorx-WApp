# CloudWorx-WApp
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](https://www.javascript.com)
[![Sass](https://img.shields.io/badge/Sass-C69?logo=sass&logoColor=fff)](https://sass-lang.com)

HTML/JS web client for [CloudWorx](https://github.com/Nanda128/CloudWorx-Backend) project.

<p align="center">
    <img alt="Home Page Screenshot" src="./docs/img/png/home.png" />
    <br />
    <em>CloudWorx Website Home Page</em>
</p>

## 📋 Quick Start

1. **Clone the repository**
2. **Set up environment**:
    - Copy [`.env.example`](./.env.example) to `.env` and update with valid keys (contact [darragh0](https://github.com/darragh0))
3. **Follow [Automated Setup](#automated-setup-recommended) or [Manual Setup](#manual-setup) steps**
4. **Run the app using `npm start`/`npm run serve` (or `npm run dev` for auto-reload)**
5. **Open [https://localhost:3443](https://localhost:3443)**

> [!NOTE]
> You may see a security warning in your browser the first time you run the app. This is expected with local certificates and can safely be ignored.

## 🔧 Setup Options

### Automated Setup (Recommended)

Use the Python setup script ([`init.py`](./init.py)) (assuming you have [Python](https://www.python.org) installed).

```sh
python ./init.py
```

### Manual Setup

If you prefer to set up the project manually, follow these steps:

#### 1. Generate local SSL certificates using [mkcert](https://github.com/FiloSottile/mkcert):

**Install mkcert**:
- Windows (with Chocolatey): `choco install mkcert`
- macOS (with Homebrew): `brew install mkcert nss`
- Linux (Debian/Ubuntu): `sudo apt install libnss3-tools` and download mkcert

**Generate certificates**:
```sh
mkcert -install
mkdir certs && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost
```

#### 2. Install dependencies (assuming you have [Node.js](https://nodejs.org/en) installed)
```sh
npm install
```

#### 3. Compile SCSS/SASS Files
```sh
npm run compile-sass
```

> [!NOTE]
> Alternativley, you can use `npm run watch-sass` to recompile on updates.

## Project File Structure

After following the setup steps, the project tree should look like the following (excluding some files/folders). Only files within the `pub` folder are visible to the end user.

The console output of the JS files in the `priv` folder is sent to stdout of the terminal you ran the application in.

```
.
├── certs                 -> Generated SSL certificates
├── node-modules          -> Node modules (argon2, express, etc.)
├── scss                  -> Uncompiled SCSS files
├── priv                  -> Server-side functionality (server setup, registration, login, etc.)
├── pub                   -> Client-side files (HTML, JS, CSS compiled from SCSS, etc.)
├── .env                  -> Required environment variables
├── init.py               -> Python setup script
├── package.json          -> Project manifest
└── README.md
```

## 🔒 Why HTTPS?

This application requires [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) features like `crypto.subtle`, which only work in secure contexts (HTTPS).
