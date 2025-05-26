#!/usr/bin/env bash
# CloudWorx Setup Script for Linux/macOS

set -e  # Exit on error

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to print colored messages
pmsg() {
  echo -e "${GREEN}[CloudWorx Setup] $1${NC}"
}

pwarn() {
  echo -e "${YELLOW}[CloudWorx Setup :: warning] $1${NC}"
}

perr() {
  echo -e "${RED}[CloudWorx Setup :: error] $1${NC}"
}

# Check if running as root (avoid this for npm installations)
if [ "$(id -u)" = "0" ]; then
  pwarn "This script is running as root. It's generally not recommended to install npm packages as root."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

pmsg "Starting CloudWorx setup..."

# 1. Environment Setup
pmsg "Setting up environment..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    pmsg "Created .env file from template."
    pwarn "You need to update the RECAPTCHA_SECRET_KEY in the .env file."
    pwarn "Contact darragh0 (https://github.com/darragh0) for the actual values."
  else
    perr ".env.example file not found!"
    exit 1
  fi
else
  pmsg ".env file already exists."
fi

# Check for valid RECAPTCHA_SECRET_KEY in .env
pmsg "Checking RECAPTCHA_SECRET_KEY in .env file..."
RECAPTCHA_VALUE=$(grep -E "^RECAPTCHA_SECRET_KEY=" .env | cut -d '=' -f2)

if [ -z "$RECAPTCHA_VALUE" ]; then
  perr "RECAPTCHA_SECRET_KEY is not set in .env file!"
  perr "Please update the .env file with a valid RECAPTCHA_SECRET_KEY."
  perr "Contact darragh0 (https://github.com/darragh0) for the actual value."
  exit 1
fi

if [ "$RECAPTCHA_VALUE" = "your_recaptcha_secret_key_here" ]; then
  perr "RECAPTCHA_SECRET_KEY in .env file still has the default placeholder value!"
  perr "Please update the .env file with a valid RECAPTCHA_SECRET_KEY."
  perr "Contact darragh0 (https://github.com/darragh0) for the actual value."
  exit 1
fi

pmsg "RECAPTCHA_SECRET_KEY is set."

# 2. Certificate Setup
pmsg "Setting up SSL certificates..."

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
  pmsg "mkcert not found. Attempting to install..."
  
  # Detect package manager and install mkcert
  if command -v apt-get &> /dev/null; then
    pmsg "Detected apt package manager"
    sudo apt-get update
    sudo apt-get install -y libnss3-tools
    
    # Check if mkcert is already in path (might be installed through other means)
    if ! command -v mkcert &> /dev/null; then
      pmsg "Downloading mkcert..."
      curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
      chmod +x mkcert-v*-linux-amd64
      sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    fi
    
  elif command -v yum &> /dev/null; then
    pmsg "Detected yum package manager"
    sudo yum install -y nss-tools
    
    # Check if mkcert is already in path
    if ! command -v mkcert &> /dev/null; then
      pmsg "Downloading mkcert..."
      curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
      chmod +x mkcert-v*-linux-amd64
      sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    fi
    
  elif command -v brew &> /dev/null; then
    pmsg "Detected Homebrew package manager"
    brew install mkcert nss
    
  else
    perr "Could not detect a supported package manager (apt, yum, or brew)."
    perr "Please install mkcert manually: https://github.com/FiloSottile/mkcert"
    exit 1
  fi
fi

# Check again if mkcert is installed
if ! command -v mkcert &> /dev/null; then
  perr "Failed to install mkcert. Please install it manually."
  exit 1
fi

# Install local CA
pmsg "Installing local CA..."
mkcert -install

# Generate certificates
pmsg "Generating certificates for localhost..."
mkdir -p certs
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost

# 3. Install dependencies and run app
pmsg "Installing Node.js dependencies..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  perr "npm is not installed. Please install Node.js and npm."
  exit 1
fi

npm install

pmsg "Setup completed successfully!"

# 4. Run the app and open browser
pmsg "Starting the application..."

# Function to open URL in browser based on OS
open_browser() {
  local url=$1
  
  # Try to detect the OS
  case "$(uname -s)" in
    Linux*)
      # Try various Linux browser openers
      if command -v xdg-open &> /dev/null; then
        xdg-open "$url" &
      elif command -v gnome-open &> /dev/null; then
        gnome-open "$url" &
      elif command -v kde-open &> /dev/null; then
        kde-open "$url" &
      else
        pwarn "Couldn't find a browser opener. Please open $url manually."
      fi
      ;;
    Darwin*)  # macOS
      open "$url" &
      ;;
    *)
      pwarn "Unknown OS. Please open $url manually."
      ;;
  esac
}

# Start the server in the background
pmsg "Starting server on https://localhost:3443"
npm run serve &
server_pid=$!

# Give the server a moment to start
sleep 3

# Open the browser
open_browser "https://localhost:3443"

# Display info to user
pmsg "Server running at https://localhost:3443"
pmsg "Press Ctrl+C to stop the server"

# Wait for user to press Ctrl+C
trap "kill $server_pid 2>/dev/null || true; pmsg 'Server stopped.'; exit 0" INT TERM
wait $server_pid
