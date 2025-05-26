# CloudWorx Setup Script for Windows
# Run this script with PowerShell

# Function to print colored messages
function Write-ColorMessage {
    param (
        [string]$Message,
        [string]$Color = "Green"
    )
    Write-Host "[CloudWorx Setup] $Message" -ForegroundColor $Color
}

function Write-Warning {
    param (
        [string]$Message
    )
    Write-Host "[CloudWorx Setup :: warning]: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param (
        [string]$Message
    )
    Write-Host "[CloudWorx Setup :: error]: $Message" -ForegroundColor Red
}

# Check if running as administrator and restart with elevation if needed
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "This script requires administrator privileges."
    Write-ColorMessage "Attempting to restart with elevated privileges..." "Yellow"
    
    # Get the current script path
    $scriptPath = $MyInvocation.MyCommand.Definition
    $scriptDir = Split-Path -Parent $scriptPath
    
    try {
        # Start a new PowerShell process with elevated privileges
        Start-Process PowerShell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $scriptDir
        exit
    }
    catch {
        Write-Error "Failed to restart with elevated privileges."
        Write-Error "Please run this script as administrator manually."
        Write-Error "Right-click on PowerShell and select 'Run as Administrator', then navigate to the script location and run it."
        Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

Write-ColorMessage "Starting CloudWorx setup..."

# 1. Environment Setup
Write-ColorMessage "Setting up environment..."
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-ColorMessage "Created .env file from template."
        Write-Warning "You need to update the RECAPTCHA_SECRET_KEY in the .env file."
        Write-Warning "Contact darragh0 (https://github.com/darragh0) for the actual values."
    } else {
        Write-Error ".env.example file not found!"
        Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
} else {
    Write-ColorMessage ".env file already exists."
}

# Check for valid RECAPTCHA_SECRET_KEY in .env
Write-ColorMessage "Checking RECAPTCHA_SECRET_KEY in .env file..."
$envContent = Get-Content .env -ErrorAction SilentlyContinue
$recaptchaLine = $envContent | Where-Object { $_ -match "^RECAPTCHA_SECRET_KEY=" }

if (-not $recaptchaLine) {
    Write-Error "RECAPTCHA_SECRET_KEY is not set in .env file!"
    Write-Error "Please update the .env file with a valid RECAPTCHA_SECRET_KEY."
    Write-Error "Contact darragh0 (https://github.com/darragh0) for the actual value."
    Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$recaptchaValue = $recaptchaLine -replace "^RECAPTCHA_SECRET_KEY=", ""

if (-not $recaptchaValue -or $recaptchaValue -eq "your_recaptcha_secret_key_here") {
    Write-Error "RECAPTCHA_SECRET_KEY in .env file still has the default placeholder value!"
    Write-Error "Please update the .env file with a valid RECAPTCHA_SECRET_KEY."
    Write-Error "Contact darragh0 (https://github.com/darragh0) for the actual value."
    Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-ColorMessage "RECAPTCHA_SECRET_KEY is set."

# 2. Certificate Setup
Write-ColorMessage "Setting up SSL certificates..."

# Check if mkcert is installed (using Chocolatey)
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-ColorMessage "mkcert not found. Attempting to install..."
    
    # Check if Chocolatey is installed
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Warning "Chocolatey not found. You need to install Chocolatey package manager first."
        Write-ColorMessage "Installing Chocolatey..." "Yellow"
        
        if (-not $isAdmin) {
            Write-Error "Administrator privileges required to install Chocolatey."
            Write-Error "Please run this script as administrator or install Chocolatey manually."
            Write-Error "See: https://chocolatey.org/install"
            exit
        }
        
        # Install Chocolatey
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    
    # Install mkcert using Chocolatey
    Write-ColorMessage "Installing mkcert using Chocolatey..."
    if ($isAdmin) {
        choco install mkcert -y
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
    Write-Error "Administrator privileges required to install mkcert."
    Write-Error "Please run this script as administrator or install mkcert manually."
    Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
    }
}

# Check again if mkcert is installed
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Error "Failed to install mkcert. Please install it manually."
    Write-Error "Use: choco install mkcert"
    Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Install local CA
Write-ColorMessage "Installing local CA..."
mkcert -install

# Generate certificates
Write-ColorMessage "Generating certificates for localhost..."
if (-not (Test-Path certs)) {
    New-Item -ItemType Directory -Path certs | Out-Null
}
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost

# 3. Install dependencies and run app
Write-ColorMessage "Installing Node.js dependencies..."

# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed. Please install Node.js and npm."
    Write-Error "Download from: https://nodejs.org/"
    Write-Host "`nPress any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

npm install

Write-ColorMessage "Setup completed successfully!"

# 4. Run the app and open browser
Write-ColorMessage "Starting the application..."

# Function to open URL in default browser
function Open-Browser {
    param (
        [string]$Url
    )
    
    try {
        Start-Process $Url
    } catch {
        Write-Warning "Couldn't open the browser automatically. Please open $Url manually."
    }
}

# Start the server in a new window
Write-ColorMessage "Starting server on https://localhost:3443"
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run serve
}

# Give the server a moment to start
Start-Sleep -Seconds 3

# Open the browser
Open-Browser "https://localhost:3443"

# Display info to user
Write-ColorMessage "Server running at https://localhost:3443"
Write-ColorMessage "Press Ctrl+C to stop the server"

try {
    # Wait for user to press Ctrl+C
    while ($serverJob.State -eq "Running") {
        Start-Sleep -Seconds 1
    }
} finally {
    # Clean up
    if ($serverJob.State -eq "Running") {
        Stop-Job $serverJob
        Remove-Job $serverJob
        Write-ColorMessage "Server stopped."
    }
    
    # Always pause before closing, in case of unexpected exit
    Write-Host "`nServer has stopped. Press any key to exit..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
