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

# Get the script directory regardless of where it's called from
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"  # The project directory is the same as the script directory

# Check if we're in the project directory, if not, change to it
CURRENT_DIR="$(pwd)"
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
  pwarn "Script is not running from the project directory."
  pmsg "Changing directory to: $PROJECT_DIR"
  cd "$PROJECT_DIR"
  pmsg "Current directory is now: $(pwd)"
fi

# Detect if running in WSL
IS_WSL=0
if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1
  pwarn "Detected Windows Subsystem for Linux (WSL) environment."
  pwarn "Some special handling will be applied for compatibility."
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
  perr "npm is not installed. Please install Node.js and npm."
  exit 1
fi

# Special handling for WSL environment
if [ "$IS_WSL" -eq 1 ]; then
  pwarn "In WSL, using special npm installation process to avoid path issues..."
  
  # Check if the Windows version of npm is available and prefer it for native modules
  if command -v cmd.exe &> /dev/null; then
    if cmd.exe /c "where npm" &> /dev/null; then
      pwarn "Using Windows npm for installation to avoid native module build issues."
      pwarn "This may take a moment..."
      
      # Create a temporary script to run npm install with Windows npm
      cat > ./.wsl_npm_install.bat << 'EOF'
@echo off
cd %~dp0
echo Installing dependencies with Windows npm...
npm install
exit /b %errorlevel%
EOF
      
      # Make the script executable and run it
      chmod +x ./.wsl_npm_install.bat
      cmd.exe /c ".\.wsl_npm_install.bat"
      npm_result=$?
      rm ./.wsl_npm_install.bat
      
      if [ $npm_result -ne 0 ]; then
        pwarn "Windows npm installation had issues. Trying with Linux npm..."
        npm install --no-optional
      fi
    else
      # Use Linux npm but skip optional dependencies that might require native builds
      pwarn "Windows npm not found. Using Linux npm with --no-optional flag..."
      npm install --no-optional
    fi
  else
    # Fallback to Linux npm with reduced features
    pwarn "Windows cmd.exe not available. Using Linux npm with --no-optional flag..."
    npm install --no-optional
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
  
  # For WSL, try to use Windows browser first
  if [ "$IS_WSL" -eq 1 ]; then
    if command -v cmd.exe &> /dev/null; then
      pmsg "Opening browser using Windows explorer..."
      cmd.exe /c "start $url" &> /dev/null
      return
    fi
  fi
  
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

# Wait for user to press Ctrl+C
trap "kill $server_pid 2>/dev/null || true; pmsg 'Server stopped.'; exit 0" INT TERM
wait $server_pid
