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
    - Copy `.env.example` to `.env`
    - Update with valid RECAPTCHA key (contact [darragh0](https://github.com/darragh0))
3. **Follow [Automated Setup](#automated-setup-recommended) or [Manual Setup](#manual-setup) steps**
4. **Run the app using `npm run serve` (or `npm run dev` for auto-reload)**
5. **Open [https://localhost:3443](https://localhost:3443)**

> [!NOTE]
> You may see a security warning in your browser the first time you run the app. This is expected with local certificates and can safely be ignored.

## 🔧 Setup Options

### Automated Setup (Recommended)

Use [`init-scripts/init.sh`](./init-scripts/init.sh) (Linux/macOS) or [`init-scripts/init.ps1`](./init-scripts/init.ps1) (Windows).

#### Linux and macOS
```sh
chmod +x init-scripts/init.sh && ./init-scripts/init.sh
```

#### Windows
```powershell
Start-Process wt.exe -Verb RunAs -ArgumentList "pwsh -NoExit -Command Set-Location '$PWD' && .\init-scripts\init.ps1"
```

> [!NOTE]
> Administrator privileges are required for the Powershell script.

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

## 🔒 Why HTTPS?

This application requires [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) features like `crypto.subtle`, which only work in secure contexts (HTTPS).
