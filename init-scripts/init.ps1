# CloudWorx Setup Script for Windows
# Run this script with PowerShell

# Function to print colored messages with only the prefix colored
function Write-ColorMessage {
    param (
        [string]$Message,
        [string]$Color = "Green"
    )
    Write-Host "[CloudWorx Setup]" -ForegroundColor $Color -NoNewline
    Write-Host " $Message"
}

function Write-Warning {
    param (
        [string]$Message
    )
    Write-Host "[CloudWorx Setup :: warning]" -ForegroundColor Yellow -NoNewline
    Write-Host " $Message"
}

function Write-Error {
    param (
        [string]$Message
    )
    Write-Host "[CloudWorx Setup :: error]" -ForegroundColor Red -NoNewline
    Write-Host " $Message"
}

# Function to run a command and display output normally
function Invoke-CommandWithOutput {
    param (
        [scriptblock]$ScriptBlock
    )
    Write-Host ""  # Add blank line before command output
    & $ScriptBlock
    Write-Host ""  # Add blank line after command output
}

# Check if running as administrator and restart with elevation if needed
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# Get the script directory regardless of where it's called from
$scriptPath = $MyInvocation.MyCommand.Definition
$scriptDir = Split-Path -Parent $scriptPath
$projectDir = Split-Path -Parent $scriptDir  # The project directory is one level up from the script directory

# Check if we're in the project directory, if not, change to it
$currentDir = Get-Location
if ($currentDir.Path -ne $projectDir) {
    Write-Warning "Script is not running from the project directory."
    Write-ColorMessage "Changing directory to: $projectDir" "Green"
    Set-Location $projectDir
    Write-ColorMessage "Current directory is now: $(Get-Location)" "Green"
}

if (-not $isAdmin) {
    Write-Warning "This script requires administrator privileges."
    Write-ColorMessage "Attempting to restart with elevated privileges..." "Green"
    
    try {
        # Start a new PowerShell process with elevated privileges
        Start-Process PowerShell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $projectDir
        exit
    }
    catch {
        Write-Error "Failed to restart with elevated privileges."
        Write-Error "Please run this script as administrator manually."
        Write-Error "Right-click on PowerShell and select 'Run as Administrator', then navigate to the script location and run it."
        Write-Host "`nPress any key to exit..." -ForegroundColor Green
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

Write-ColorMessage "Starting CloudWorx setup..."

# Display and verify current working directory
$currentDir = Get-Location
Write-ColorMessage "Working directory: $currentDir" "Green"

# Verify we're in the project directory
if (!(Test-Path ".env.example") -and !(Test-Path "package.json")) {
    Write-Error "Could not find key project files. This doesn't appear to be the CloudWorx project directory."
    Write-Error "Current directory: $currentDir"
    Write-Host "`nPress any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 1. Environment Setup
Write-ColorMessage "Setting up environment..."

# Function to handle reCAPTCHA key errors
function Show-RecaptchaError {
    param (
        [string]$Reason
    )
    Write-Error $Reason
    Write-Error "Please update the .env file with a valid RECAPTCHA_SECRET_KEY."
    Write-Error "Contact darragh0 (https://github.com/darragh0) for the actual value."
    Write-Host "`nPress any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-ColorMessage "Created .env file from template."
        Write-Warning "Remember to set a valid RECAPTCHA_SECRET_KEY in the .env file."
    } else {
        Write-Error ".env.example file not found!"
        Write-Host "`nPress any key to exit..." -ForegroundColor Green
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
    Show-RecaptchaError "RECAPTCHA_SECRET_KEY is not set in .env file!"
}

$recaptchaValue = $recaptchaLine -replace "^RECAPTCHA_SECRET_KEY=", ""

if (-not $recaptchaValue -or $recaptchaValue -eq "your_recaptcha_secret_key_here") {
    Show-RecaptchaError "RECAPTCHA_SECRET_KEY in .env file still has the default placeholder value!"
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
        Write-ColorMessage "Installing Chocolatey..." "Yellow"
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-CommandWithOutput { 
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        }
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    
    # Install mkcert using Chocolatey
    Write-ColorMessage "Installing mkcert using Chocolatey..."
    if ($isAdmin) {
        Invoke-CommandWithOutput { choco install mkcert -y }
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
    Write-Error "Administrator privileges required to install mkcert."
    Write-Error "Please run this script as administrator or install mkcert manually."
    Write-Host "`nPress any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
    }
}

# Check again if mkcert is installed
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Error "Failed to install mkcert. Please install it manually."
    Write-Error "Use: choco install mkcert"
    Write-Host "`nPress any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Install local CA
Write-ColorMessage "Installing local CA..."
Invoke-CommandWithOutput { mkcert -install }

# Generate certificates
Write-ColorMessage "Generating certificates for localhost..."
if (-not (Test-Path certs)) {
    New-Item -ItemType Directory -Path certs | Out-Null
}
Invoke-CommandWithOutput { mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost }

# 3. Install dependencies and run app
Write-ColorMessage "Checking for Node.js..."

# Function to install Node.js using Chocolatey
function Install-NodeJS {
    Write-ColorMessage "Installing Node.js..." "Yellow"
    
    # Check if Chocolatey is available
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Error "Chocolatey is required to install Node.js automatically."
        Write-Error "Please install Node.js manually from https://nodejs.org/"
        Write-Host "`nPress any key to exit..." -ForegroundColor Green
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Install Node.js using Chocolatey
    Invoke-CommandWithOutput { choco install nodejs-lts -y }
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    # Verify installation
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "Failed to install Node.js. Please install it manually."
        Write-Error "Download from: https://nodejs.org/"
        Write-Host "`nPress any key to exit..." -ForegroundColor Green
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    Write-ColorMessage "Node.js installed successfully: $(node -v)"
    Write-ColorMessage "npm installed successfully: $(npm -v)"
}

# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-ColorMessage "Node.js is not installed. Attempting to install automatically..." "Yellow"
    Install-NodeJS
}
else {
    Write-ColorMessage "Node.js is already installed: $(node -v)"
}

Write-ColorMessage "Installing dependencies..."
Invoke-CommandWithOutput { npm install }

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
$currentDir = Get-Location
Write-ColorMessage "Server directory: $currentDir" "Green"

# Start the server in a background job
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run serve
}

# Give the server a moment to start
Start-Sleep -Seconds 3

# Receive job output and display it with proper formatting
$output = Receive-Job -Job $serverJob -Keep
if ($output) {
    Write-Host ""  # Add blank line before server output
    foreach ($line in $output) {
        Write-Host $line
    }
    Write-Host ""  # Add blank line after server output
}

# Open the browser
Write-ColorMessage "Opening browser..."
Open-Browser "https://localhost:3443"

# Display info to user
Write-ColorMessage "Server running at https://localhost:3443"

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
    Write-Host "`nServer has stopped. Press any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
