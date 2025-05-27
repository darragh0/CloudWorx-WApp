#!/usr/bin/env bash
# CloudWorx Setup Script for Linux/macOS

set -e  # Exit on error

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

pmsg() {
  echo -e "${GREEN}[CloudWorx Setup] $1${NC}"
}

pwarn() {
  echo -e "${YELLOW}[CloudWorx Setup :: warning] $1${NC}"
}

perr() {
  echo -e "${RED}[CloudWorx Setup :: error] $1${NC}"
}

# Get the script directory regardless of where it's called from
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"  # The project directory is the same as the script directory

# Check if we're in the project directory, if not, change dir
CURRENT_DIR="$(pwd)"
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
  pwarn "Script is not running from the project directory."
  pmsg "Changing directory to: $PROJECT_DIR"
  cd "$PROJECT_DIR"
  pmsg "Current directory is now: $(pwd)"
fi

# Check if running in WSL
IS_WSL=0
if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1
fi

# Check if running as root (avoid this for npm installations)
if [ "$(id -u)" = "0" ]; then
  pwarn "This script is running as root. It's generally not recommended to install npm packages as root."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check for npm cache directory permissions issue (common in WSL)
if [ "$IS_WSL" -eq 1 ] && [ -d "$HOME/.npm" ] && [ ! -w "$HOME/.npm" ]; then
  pmsg "Fixing npm cache permissions..."
  sudo chown -R $(whoami) $HOME/.npm
fi

pmsg "Starting CloudWorx setup..."

# Display and verify current working directory
CURRENT_DIR="$(pwd)"
pmsg "Working directory: $CURRENT_DIR"

# Verify we're in the project directory
if [ ! -f ".env.example" ] && [ ! -f "package.json" ]; then
  perr "Could not find key project files. This doesn't appear to be the CloudWorx project directory."
  perr "Current directory: $CURRENT_DIR"
  exit 1
fi

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
  pmsg "npm is not installed. Attempting to install Node.js..."
  
  if [ "$IS_WSL" -eq 1 ] || command -v apt-get &> /dev/null; then
    # Install Node.js using apt (for Debian/Ubuntu/WSL)
    pmsg "Installing Node.js using apt..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - &> /dev/null
    sudo apt-get install -y nodejs
    
    # Verify installation
    if ! command -v npm &> /dev/null; then
      perr "Failed to install Node.js. Please install it manually."
      exit 1
    fi
    
    pmsg "Node.js installed successfully: $(node -v)"
    pmsg "npm installed successfully: $(npm -v)"
  elif command -v yum &> /dev/null; then
    # Install Node.js using yum (for CentOS/RHEL/Fedora)
    pmsg "Installing Node.js using yum..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo -E bash - &> /dev/null
    sudo yum install -y nodejs
    
    # Verify installation
    if ! command -v npm &> /dev/null; then
      perr "Failed to install Node.js. Please install it manually."
      exit 1
    fi
    
    pmsg "Node.js installed successfully: $(node -v)"
    pmsg "npm installed successfully: $(npm -v)"
  elif command -v brew &> /dev/null; then
    # Install Node.js using Homebrew (for macOS)
    pmsg "Installing Node.js using Homebrew..."
    brew install node
    
    # Verify installation
    if ! command -v npm &> /dev/null; then
      perr "Failed to install Node.js. Please install it manually."
      exit 1
    fi
    
    pmsg "Node.js installed successfully: $(node -v)"
    pmsg "npm installed successfully: $(npm -v)"
  else
    perr "npm is not installed and could not detect a supported package manager."
    perr "Please install Node.js manually and run this script again."
    exit 1
  fi
fi

# Special handling for WSL environment
if [ "$IS_WSL" -eq 1 ]; then
  # Verify we're using the Linux version of npm
  NPM_PATH=$(which npm)
  if [[ "$NPM_PATH" == *"/mnt/c/"* ]] || [[ "$NPM_PATH" == *"/c/"* ]]; then
    pmsg "Detected Windows npm in WSL environment. Installing Linux Node.js instead..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - &> /dev/null
    sudo apt-get install -y nodejs
    
    # Verify installation
    if ! command -v npm &> /dev/null; then
      perr "Failed to install Node.js. Please install it manually."
      exit 1
    fi
    
    pmsg "Node.js installed successfully: $(node -v)"
    pmsg "npm installed successfully: $(npm -v)"
    NPM_PATH=$(which npm)
  fi
  
  pmsg "Using Linux npm: $NPM_PATH"
  
  # First try: Check if we can create the node_modules directory with the current user
  if [ ! -d "node_modules" ]; then
    mkdir -p node_modules 2>/dev/null || true
  fi
  
  # Second try: Fix permissions if the directory exists but is not writable
  if [ -d "node_modules" ] && [ ! -w "node_modules" ]; then
    pmsg "Fixing permissions for node_modules directory..."
    sudo chown -R $(whoami) node_modules
  fi
  
  # Try to install without sudo first
  pmsg "Installing dependencies..."
  if npm install --no-optional; then
    pmsg "Dependencies installed successfully."
  else
    pwarn "Permission issues detected. Trying with sudo..."
    # If normal install fails, use sudo
    sudo npm install --no-optional
  fi
else
  # Normal npm install for non-WSL environments
  npm install
fi

pmsg "Setup completed successfully!"

# 4. Run the app and open browser
pmsg "Starting the application..."

# Function to open URL in browser based on OS
open_browser() {
  local url=$1
  
  # For WSL, try to use the wslview command which is the proper way to open URLs
  if [ "$IS_WSL" -eq 1 ]; then
    if command -v wslview &> /dev/null; then
      pmsg "Opening browser..."
      wslview "$url"
      return
    elif command -v explorer.exe &> /dev/null; then
      pmsg "Opening browser..."
      explorer.exe "$url"
      return
    else
      pwarn "Could not find wslview or explorer.exe. Please open the URL manually: $url"
      return
    fi
  fi
  
  # For non-WSL Linux or macOS
  case "$(uname -s)" in
    Linux*)
      # Try various Linux browser openers
      if command -v xdg-open &> /dev/null; then
        pmsg "Opening browser..."
        xdg-open "$url" &
      elif command -v gnome-open &> /dev/null; then
        pmsg "Opening browser..."
        gnome-open "$url" &
      elif command -v kde-open &> /dev/null; then
        pmsg "Opening browser..."
        kde-open "$url" &
      else
        pwarn "Couldn't find a browser opener. Please open $url manually."
      fi
      ;;
    Darwin*)  # macOS
      pmsg "Opening browser..."
      open "$url" &
      ;;
    *)
      pwarn "Unknown OS. Please open $url manually."
      ;;
  esac
}

# Start the server in the background
pmsg "Starting server on https://localhost:3443"

# Check if we might need sudo for port access
if [ "$IS_WSL" -eq 1 ] || [ "$(id -u)" != "0" ]; then
  # Try to start normally first
  npm run serve &
  server_pid=$!
  
  # Check if the server started successfully
  sleep 2
  if ! kill -0 $server_pid 2>/dev/null; then
    pwarn "Failed to start server normally, trying with elevated permissions..."
    sudo npm run serve &
    server_pid=$!
  fi
else
  npm run serve &
  server_pid=$!
fi

# Verify server is running
sleep 2
if ! kill -0 $server_pid 2>/dev/null; then
  perr "Failed to start the server. Please check the logs for errors."
  exit 1
else
  pmsg "Server started successfully with PID: $server_pid"
fi

# Give the server a moment to start
sleep 2

# Open the browser
open_browser "https://localhost:3443"

# Display info to user
pmsg "Server running at https://localhost:3443"

# Wait for user to press Ctrl+C
trap "kill $server_pid 2>/dev/null || true; pmsg 'Server stopped.'; exit 0" INT TERM
wait $server_pid
