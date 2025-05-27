#!/usr/bin/env bash
# CloudWorx Setup Script for Linux/macOS

set -e  # Exit on error

# ============================================================================
# Colors and formatting
# ============================================================================
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly DIM='\033[2m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

pbanner() {
  echo -e "
    \e[0;1;34;94m▄▄▄▄\e[0m   \e[0;34m▄▄▄▄\e[0m                                \e[0;1;30;90m▄▄\e[0m \e[0;1;30;90m▄▄\e[0m      \e[0;1;34;94m▄▄\e[0m
  \e[0;34m██▀▀▀▀█\e[0m  \e[0;34m▀▀██\e[0m                                \e[0;1;30;90m█\e[0;1;34;94m█\e[0m \e[0;1;34;94m██\e[0m      \e[0;1;34;94m██\e[0m
 \e[0;34m██▀\e[0m         \e[0;37m██\e[0m       \e[0;37m▄█\e[0;1;30;90m███▄\e[0m   \e[0;1;30;90m██\e[0m    \e[0;1;30;90m██\e[0m   \e[0;1;34;94m▄███▄██\e[0m \e[0;1;34;94m▀█▄\e[0m \e[0;1;34;94m██\e[0m \e[0;34m▄█▀\e[0m  \e[0;34m▄████▄\e[0m    \e[0;37m██▄████\e[0m  \e[0;37m▀██\e[0m  \e[0;37m██\e[0;1;30;90m▀\e[0m
 \e[0;37m██\e[0m          \e[0;37m██\e[0m      \e[0;1;30;90m██▀\e[0m  \e[0;1;30;90m▀██\e[0m  \e[0;1;30;90m█\e[0;1;34;94m█\e[0m    \e[0;1;34;94m██\e[0m  \e[0;1;34;94m██▀\e[0m  \e[0;1;34;94m▀█\e[0;34m█\e[0m  \e[0;34m██\e[0m \e[0;34m██\e[0m \e[0;34m██\e[0m  \e[0;34m██▀\e[0m  \e[0;37m▀██\e[0m   \e[0;37m██▀\e[0m        \e[0;1;30;90m████\e[0m
 \e[0;37m██▄\e[0m         \e[0;1;30;90m██\e[0m      \e[0;1;30;90m██\e[0m    \e[0;1;34;94m██\e[0m  \e[0;1;34;94m██\e[0m    \e[0;1;34;94m██\e[0m  \e[0;34m██\e[0m    \e[0;34m██\e[0m  \e[0;34m███▀▀\e[0;37m███\e[0m  \e[0;37m██\e[0m    \e[0;37m██\e[0m   \e[0;1;30;90m██\e[0m         \e[0;1;30;90m▄██▄\e[0m
  \e[0;1;30;90m██▄▄▄▄█\e[0m    \e[0;1;30;90m██▄\e[0;1;34;94m▄▄\e[0m   \e[0;1;34;94m▀██▄▄██▀\e[0m  \e[0;1;34;94m█\e[0;34m█▄▄▄███\e[0m  \e[0;34m▀██▄▄██\e[0;37m█\e[0m  \e[0;37m███\e[0m  \e[0;37m███\e[0m  \e[0;37m▀██\e[0;1;30;90m▄▄██▀\e[0m   \e[0;1;30;90m██\e[0m        \e[0;1;34;94m▄█▀▀█▄\e[0m
    \e[0;1;30;90m▀▀▀▀\e[0m      \e[0;1;34;94m▀▀▀▀\e[0m     \e[0;1;34;94m▀\e[0;34m▀▀▀\e[0m     \e[0;34m▀▀▀▀\e[0m \e[0;34m▀▀\e[0m    \e[0;37m▀▀▀\e[0m \e[0;37m▀▀\e[0m  \e[0;37m▀▀▀\e[0m  \e[0;1;30;90m▀▀▀\e[0m    \e[0;1;30;90m▀▀▀▀\e[0m     \e[0;1;34;94m▀▀\e[0m       \e[0;1;34;94m▀▀▀\e[0m  \e[0;1;34;94m▀▀\e[0;34m▀\e[0m"
}

# ============================================================================
# Logging functions
# ============================================================================
pmsg() {
  local indent="${2:-0}"
  printf "%*s" "$indent" ""
  echo -e "${GREEN}✓${NC} $1"
}

pinfo() {
  local indent="${2:-0}"
  printf "%*s" "$indent" ""
  echo -e "${BLUE}•${NC} $1"
}

pwarn() {
  local indent="${2:-0}"
  printf "%*s" "$indent" ""
  echo -e "${YELLOW}!${NC} $1"
}

perr() {
  local indent="${2:-0}"
  printf "%*s" "$indent" ""
  echo -e "${RED}✗${NC} $1"
}

pstep() {
  local indent="${2:-0}"
  printf "%*s" "$indent" ""
  echo -e "${BLUE}→${NC} $1"
}

process_output() {
  local indent="$1"
  ((indent += 4))
  local line

  while IFS= read -r line; do
    # Trim leading/trailing whitespace
    local trimmed="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    # Skip empty lines
    [ -z "$trimmed" ] && continue

    # Strip ANSI codes & print
    local clean_line=$(echo "$trimmed" | sed 's/\x1b\[[0-9;]*m//g')
    printf "%*s" "$indent" ""
    printf "${DIM}%s${NC}\n" "$clean_line"
  done
}


# Run commands with dimmed output
run_cmd() {
  local cmd="$1"
  local desc="$2"

  local indent="${3:-0}"

  if [ -n "$desc" ]; then
    pstep "$desc" "$indent"
  fi

  if eval "$cmd" 2>&1 | process_output "$indent"; then
    return 0
  else
    return 1
  fi
}

# Run commands silently with simple progress
run_silent() {
  local cmd="$1"
  local desc="$2"

  local indent="${3:-0}"
  printf "%*s" "$indent" ""

  pstep "$desc" "$indent"
  if eval "$cmd" >/dev/null 2>&1; then
    return 0
  else
    pwarn "Command failed, showing output:"
    eval "$cmd"
    return 1
  fi
}

# ============================================================================
# Setup functions
# ============================================================================
detect_system() {
  IS_WSL=0
  if grep -qi microsoft /proc/version 2>/dev/null; then
    IS_WSL=1
  fi

  if [ "$(id -u)" = "0" ]; then
    pwarn "Running as root - this may cause npm permission issues"
    echo -n "Continue? (y/N): "
    read -r reply
    [[ ! $reply =~ ^[Yy]$ ]] && exit 1
  fi

  # Fix WSL npm cache permissions
  if [ "$IS_WSL" -eq 1 ] && [ -d "$HOME/.npm" ] && [ ! -w "$HOME/.npm" ]; then
    pstep "Fixing npm cache permissions"
    sudo chown -R "$(whoami)" "$HOME/.npm"
  fi
}

validate_directories() {
  local script_dir project_dir current_dir
  script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  project_dir="$( cd "$script_dir/.." && pwd )"
  current_dir="$(pwd)"

  if [ "$current_dir" != "$project_dir" ]; then
    pinfo "Changing to project directory: $project_dir"
    cd "$project_dir"
  fi

  if [ ! -f ".env.example" ] && [ ! -f "package.json" ]; then
    perr "Missing project files - not in CloudWorx directory?"
    perr "Current: $(pwd)"
    exit 1
  fi
}

setup_environment() {
  echo -e "\n${BOLD}${BLUE}[Environment Setup]${NC}"

  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      pmsg "Created \`.env\` from template" 2
      pwarn "Set \`RECAPTCHA_SECRET_KEY\` in \`.env\` file" 2
    else
      perr "\`.env.example\` not found" 2
      exit 1
    fi
  else
    pmsg "\`.env\` file exists" 2
  fi

  # Validate reCAPTCHA key
  pstep "Checking \`RECAPTCHA_SECRET_KEY\`" 2
  local key=$(grep -E "^RECAPTCHA_SECRET_KEY=" .env | cut -d '=' -f2 2>/dev/null || echo "")

  if [ -z "$key" ] || [ "$key" = "your_recaptcha_secret_key_here" ]; then
    perr "Missing \`RECAPTCHA_SECRET_KEY\` in \`.env\` file" 2
    perr "Contact darragh0 (https://github.com/darragh0) for the key" 2
    exit 1
  fi
}

setup_certificates() {
  echo -e "\n${BOLD}${BLUE}[Certificate Setup]${NC}"

  if ! command -v mkcert &> /dev/null; then
    pstep "Installing mkcert" 2

    if command -v apt-get &> /dev/null; then
      run_silent "sudo apt-get update -qq && sudo apt-get install -y libnss3-tools" "Installing dependencies" 2
      if ! command -v mkcert &> /dev/null; then
        run_cmd "curl -JLO 'https://dl.filippo.io/mkcert/latest?for=linux/amd64' && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert" "Downloading mkcert" 2
      fi
    elif command -v yum &> /dev/null; then
      run_silent "sudo yum install -y nss-tools" "Installing dependencies" 2
      if ! command -v mkcert &> /dev/null; then
        run_cmd "curl -JLO 'https://dl.filippo.io/mkcert/latest?for=linux/amd64' && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert" "Downloading mkcert" 2
      fi
    elif command -v brew &> /dev/null; then
      run_silent "brew install mkcert nss" "Installing via Homebrew" 2
    else
      perr "No package manager found (apt/yum/brew)" 2
      perr "Install mkcert manually: https://github.com/FiloSottile/mkcert" 2
      exit 1
    fi
  else
    pmsg "mkcert already installed" 2
  fi

  run_cmd "mkcert -install" "Installing local CA" 2

  mkdir -p certs
  run_cmd "mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost" "Generating certificates" 2
}

setup_nodejs() {
  echo -e "\n${BOLD}${BLUE}[Dependency Installation]${NC}"

  if ! command -v npm &> /dev/null; then
    pstep "Installing Node.js" 2

    if [ "$IS_WSL" -eq 1 ] || command -v apt-get &> /dev/null; then
      run_silent "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs" "Installing via apt" 2
    elif command -v yum &> /dev/null; then
      run_silent "curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo -E bash - && sudo yum install -y nodejs" "Installing via yum" 2
    elif command -v brew &> /dev/null; then
      run_silent "brew install node" "Installing via Homebrew" 2
    else
      perr "No package manager found - install Node.js manually" 2
      exit 1
    fi

    if ! command -v npm &> /dev/null; then
      perr "Node.js installation failed" 2
      exit 1
    fi

    pmsg "Node.js installed: $(node -v)" 2
  else
    pmsg "Node.js found: $(node -v)" 2
  fi

  # Handle WSL npm issues
  if [ "$IS_WSL" -eq 1 ]; then
    local npm_path=$(which npm)
    if [[ "$npm_path" == *"/mnt/c/"* ]] || [[ "$npm_path" == *"/c/"* ]]; then
      pstep "Fixing WSL npm (using Windows version)" 2
      run_silent "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs" "Installing Linux Node.js" 2
    fi

    # Fix permissions
    [ ! -d "node_modules" ] && mkdir -p node_modules 2>/dev/null || true
    if [ -d "node_modules" ] && [ ! -w "node_modules" ]; then
      pstep "Fixing node_modules permissions" 2
      sudo chown -R "$(whoami)" node_modules
    fi
  fi

  # Install dependencies
  pstep "Installing dependencies" 2
  if [ "$IS_WSL" -eq 1 ]; then
    if ! run_cmd "npm install --no-optional" "" 2; then
      pwarn "Retrying with sudo" 2
      run_cmd "sudo npm install --no-optional" "" 2
    fi
  else
    run_cmd "npm install" "" 2
  fi
}

# ============================================================================
# Main execution
# ============================================================================
main() {
  pbanner

  detect_system
  validate_directories
  setup_environment
  setup_certificates
  setup_nodejs

  echo -e "\n${GREEN}${BOLD}Run${NC} \`npm run serve\` ${GREEN}${BOLD}to start the app${NC}"
}

main "$@"