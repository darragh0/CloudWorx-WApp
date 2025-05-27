#Requires -Version 5.1

# CloudWorx Setup Script for Windows

param(
    [switch]$Force
)

# ============================================================================
# Error handling and execution policy
# ============================================================================
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Check execution policy
if ((Get-ExecutionPolicy) -eq "Restricted") {
    Write-Host "PowerShell execution policy is restricted. Run this command first:" -ForegroundColor Red
    Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# Colors and formatting
# ============================================================================
$script:Colors = @{
    Green  = [System.ConsoleColor]::Green
    Blue   = [System.ConsoleColor]::Blue
    Yellow = [System.ConsoleColor]::Yellow
    Red    = [System.ConsoleColor]::Red
    Gray   = [System.ConsoleColor]::DarkGray
    White  = [System.ConsoleColor]::White
}

function Show-Banner {
Write-Host @"

    `e[0;1;34;94m▄▄▄▄`e[0m   `e[0;34m▄▄▄▄`e[0m                                `e[0;1;30;90m▄▄`e[0m `e[0;1;30;90m▄▄`e[0m      `e[0;1;34;94m▄▄`e[0m
  `e[0;34m██▀▀▀▀█`e[0m  `e[0;34m▀▀██`e[0m                                `e[0;1;30;90m█`e[0;1;34;94m█`e[0m `e[0;1;34;94m██`e[0m      `e[0;1;34;94m██`e[0m
 `e[0;34m██▀`e[0m         `e[0;37m██`e[0m       `e[0;37m▄█`e[0;1;30;90m███▄`e[0m   `e[0;1;30;90m██`e[0m    `e[0;1;30;90m██`e[0m   `e[0;1;34;94m▄███▄██`e[0m `e[0;1;34;94m▀█▄`e[0m `e[0;1;34;94m██`e[0m `e[0;34m▄█▀`e[0m  `e[0;34m▄████▄`e[0m    `e[0;37m██▄████`e[0m  `e[0;37m▀██`e[0m  `e[0;37m██`e[0;1;30;90m▀`e[0m
 `e[0;37m██`e[0m          `e[0;37m██`e[0m      `e[0;1;30;90m██▀`e[0m  `e[0;1;30;90m▀██`e[0m  `e[0;1;30;90m█`e[0;1;34;94m█`e[0m    `e[0;1;34;94m██`e[0m  `e[0;1;34;94m██▀`e[0m  `e[0;1;34;94m▀█`e[0;34m█`e[0m  `e[0;34m██`e[0m `e[0;34m██`e[0m `e[0;34m██`e[0m  `e[0;34m██▀`e[0m  `e[0;37m▀██`e[0m   `e[0;37m██▀`e[0m        `e[0;1;30;90m████`e[0m
 `e[0;37m██▄`e[0m         `e[0;1;30;90m██`e[0m      `e[0;1;30;90m██`e[0m    `e[0;1;34;94m██`e[0m  `e[0;1;34;94m██`e[0m    `e[0;1;34;94m██`e[0m  `e[0;34m██`e[0m    `e[0;34m██`e[0m  `e[0;34m███▀▀`e[0;37m███`e[0m  `e[0;37m██`e[0m    `e[0;37m██`e[0m   `e[0;1;30;90m██`e[0m         `e[0;1;30;90m▄██▄`e[0m
  `e[0;1;30;90m██▄▄▄▄█`e[0m    `e[0;1;30;90m██▄`e[0;1;34;94m▄▄`e[0m   `e[0;1;34;94m▀██▄▄██▀`e[0m  `e[0;1;34;94m█`e[0;34m█▄▄▄███`e[0m  `e[0;34m▀██▄▄██`e[0;37m█`e[0m  `e[0;37m███`e[0m  `e[0;37m███`e[0m  `e[0;37m▀██`e[0;1;30;90m▄▄██▀`e[0m   `e[0;1;30;90m██`e[0m        `e[0;1;34;94m▄█▀▀█▄`e[0m
    `e[0;1;30;90m▀▀▀▀`e[0m      `e[0;1;34;94m▀▀▀▀`e[0m     `e[0;1;34;94m▀`e[0;34m▀▀▀`e[0m     `e[0;34m▀▀▀▀`e[0m `e[0;34m▀▀`e[0m    `e[0;37m▀▀▀`e[0m `e[0;37m▀▀`e[0m  `e[0;37m▀▀▀`e[0m  `e[0;1;30;90m▀▀▀`e[0m    `e[0;1;30;90m▀▀▀▀`e[0m     `e[0;1;34;94m▀▀`e[0m       `e[0;1;34;94m▀▀▀`e[0m  `e[0;1;34;94m▀▀`e[0;34m▀`e[0m

"@ -ForegroundColor White
}

function Write-Success {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * $Indent
    Write-Host "${padding}✓ $Message" -ForegroundColor $Colors.Green
}

function Write-Info {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * $Indent
    Write-Host "${padding}• $Message" -ForegroundColor $Colors.Blue
}

function Write-Warning {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * $Indent
    Write-Host "${padding}! $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * $Indent
    Write-Host "${padding}✗ $Message" -ForegroundColor $Colors.Red
}

function Write-Step {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * $Indent
    Write-Host "${padding}→ $Message" -ForegroundColor $Colors.Blue
}

function Write-Output {
    param([string]$Message, [int]$Indent = 0)
    $padding = " " * ($Indent + 4)
    if (![string]::IsNullOrWhiteSpace($Message)) {
        Write-Host "${padding}$Message" -ForegroundColor $Colors.Gray
    }
}

# ============================================================================
# Utility functions
# ============================================================================

function Invoke-Command {
    param(
        [string]$Command,
        [string]$Description,
        [int]$Indent = 0,
        [switch]$Silent,
        [switch]$IgnoreExitCode
    )
    
    if ($Description) {
        Write-Step $Description $Indent
    }
    
    try {
        if ($Silent) {
            $output = Invoke-Expression $Command 2>&1
            if ($LASTEXITCODE -ne 0 -and -not $IgnoreExitCode) {
                Write-Warning "Command failed, showing output:" $Indent
                $output | ForEach-Object { Write-Output $_.ToString() $Indent }
                throw "Command failed with exit code $LASTEXITCODE"
            }
        }
        else {
            $output = Invoke-Expression $Command 2>&1
            $output | ForEach-Object { 
                $line = $_.ToString().Trim()
                if (![string]::IsNullOrWhiteSpace($line)) {
                    Write-Output $line $Indent
                }
            }
            if ($LASTEXITCODE -ne 0 -and -not $IgnoreExitCode) {
                throw "Command failed with exit code $LASTEXITCODE"
            }
        }
        return $true
    }
    catch {
        if (-not $Silent) {
            Write-Error "Command failed: $_" $Indent
        }
        return $false
    }
}

# ============================================================================
# Setup functions
# ============================================================================
function Test-SystemRequirements {
    Write-Info "Checking Windows version..."
    $version = [System.Environment]::OSVersion.Version
    if ($version.Major -lt 10) {
        Write-Error "Windows 10 or later is required"
        exit 1
    }
    Write-Success "Windows version: $($version.Major).$($version.Minor)"
    
    # Check if running in WSL (shouldn't happen, but just in case)
    if ($env:WSL_DISTRO_NAME) {
        Write-Error "This is the Windows PowerShell script. Use the bash script for WSL."
        exit 1
    }
}

function Test-ProjectDirectory {
    Write-Step "Validating project directory"
    
    $scriptDir = Split-Path -Parent $PSCommandPath
    $projectDir = Split-Path -Parent $scriptDir
    $currentDir = Get-Location
    
    if ($currentDir.Path -ne $projectDir) {
        Write-Info "Changing to project directory: $projectDir"
        Set-Location $projectDir
    }
    
    if (-not (Test-Path ".env.example") -and -not (Test-Path "package.json")) {
        Write-Error "Missing project files - not in CloudWorx directory?"
        Write-Error "Current: $(Get-Location)"
        exit 1
    }
    
    Write-Success "Project directory validated"
}

function Set-Environment {
    Write-Host "`n[Environment Setup]" -ForegroundColor Blue
    
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Success "Created ``.env`` from template" 2
            Write-Warning "Set ``RECAPTCHA_SECRET_KEY`` in ``.env`` file" 2
        }
        else {
            Write-Error "``.env.example`` not found" 2
            exit 1
        }
    }
    else {
        Write-Success "``.env`` file exists" 2
    }
    
    # Validate reCAPTCHA key
    Write-Step "Checking ``RECAPTCHA_SECRET_KEY``" 2
    $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
    $keyLine = $envContent | Where-Object { $_ -match "^RECAPTCHA_SECRET_KEY=" }
    
    if (-not $keyLine) {
        $key = ""
    }
    else {
        $key = ($keyLine -split "=", 2)[1]
    }
    
    if ([string]::IsNullOrWhiteSpace($key) -or $key -eq "your_recaptcha_secret_key_here") {
        Write-Error "Missing ``RECAPTCHA_SECRET_KEY`` in `.env` file" 2
        Write-Error "Contact darragh0 (https://github.com/darragh0) for the key" 2
        exit 1
    }
    
    Write-Success "``RECAPTCHA_SECRET_KEY`` configured" 2
}

function Install-Chocolatey {
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Step "Installing Chocolatey package manager ..." 2
        $installScript = Invoke-WebRequest -Uri "https://chocolatey.org/install.ps1" -UseBasicParsing
        Invoke-Expression $installScript.Content
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
            Write-Error "Chocolatey installation failed" 2
            exit 1
        }
        Write-Success "Chocolatey installed" 2
    }
    else {
        Write-Success "Chocolatey already installed" 2
    }
}

function Install-Mkcert {
    Write-Host "`n[Certificate Setup]" -ForegroundColor Blue
    
    if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
        Write-Step "Installing mkcert ..." 2
        
        # Try Chocolatey first
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            if (Invoke-Command "choco install mkcert -y" -Silent -Indent 2) {
                # Refresh PATH
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            }
        }
        
        # If Chocolatey method didn't work, try Scoop
        if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
            if (Get-Command scoop -ErrorAction SilentlyContinue) {
                Invoke-Command "scoop install mkcert" "Installing via Scoop ..." 2 -Silent
            }
            else {
                # Install Scoop first
                Write-Step "Installing Scoop package manager ..." 2
                Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')
                
                # Refresh PATH
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + $env:Path
                
                if (Get-Command scoop -ErrorAction SilentlyContinue) {
                    Invoke-Command "scoop install mkcert" "Installing mkcert via Scoop ..." 2 -Silent
                }
            }
        }
        
        # Manual download as last resort
        if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
            Write-Step "Downloading mkcert manually" 2
            $mkcertUrl = "https://dl.filippo.io/mkcert/latest?for=windows/amd64"
            $mkcertPath = "$env:TEMP\mkcert.exe"
            $targetPath = "$env:ProgramFiles\mkcert\mkcert.exe"
            
            Invoke-WebRequest -Uri $mkcertUrl -OutFile $mkcertPath
            
            # Create directory and move executable
            $targetDir = Split-Path $targetPath
            if (-not (Test-Path $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            Move-Item $mkcertPath $targetPath -Force
            
            # Add to PATH
            $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            if ($currentPath -notlike "*$targetDir*") {
                [System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$targetDir", "Machine")
                $env:Path = "$env:Path;$targetDir"
            }
        }
        
        if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
            Write-Error "Failed to install mkcert" 2
            Write-Error "Please install mkcert manually: https://github.com/FiloSottile/mkcert" 2
            exit 1
        }
    }
    else {
        Write-Success "mkcert already installed" 2
    }
    
    # Install local CA
    Invoke-Command "mkcert -install" "Installing local CA" 2
    
    # Generate certificates
    if (-not (Test-Path "certs")) {
        New-Item -ItemType Directory -Path "certs" | Out-Null
    }
    
    Invoke-Command "mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost" "Generating certificates" 2
}

function Install-NodeJS {
    Write-Host "`n[Dependency Installation]" -ForegroundColor Blue
    
    $nodeVersion = $null
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node --version 2>$null
    }
    
    if (-not $nodeVersion) {
        Write-Step "Installing Node.js ..." 2
        
        # Try Chocolatey first
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            if (Invoke-Command "choco install nodejs -y" -Silent -Indent 2) {
                # Refresh PATH
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            }
        }
        
        # If Chocolatey didn't work, download installer
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Step "Downloading Node.js installer" 2
            $nodeUrl = "https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi"
            $installerPath = "$env:TEMP\nodejs-installer.msi"
            
            Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath
            Write-Step "Running Node.js installer" 2
            Start-Process msiexec.exe -ArgumentList "/i", $installerPath, "/quiet" -Wait
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        }
        
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Error "Node.js installation failed" 2
            exit 1
        }
        
        $nodeVersion = node --version
        Write-Success "Node.js installed: $nodeVersion" 2
    }
    else {
        Write-Success "Node.js found: $nodeVersion" 2
    }
    
    # Verify npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "npm not found after Node.js installation" 2
        exit 1
    }
    
    # Install dependencies
    Write-Step "Installing dependencies" 2
    
    # Create node_modules directory if it doesn't exist
    if (-not (Test-Path "node_modules")) {
        New-Item -ItemType Directory -Path "node_modules" -Force | Out-Null
    }
    
    if (-not (Invoke-Command "npm install" -Indent 2)) {
        Write-Warning "Retrying npm install" 2
        if (-not (Invoke-Command "npm install --no-optional" -Indent 2)) {
            Write-Error "npm install failed" 2
            exit 1
        }
    }
}

# ============================================================================
# Main execution
# ============================================================================
function Main {
    Show-Banner
    
    Test-SystemRequirements
    Test-ProjectDirectory
    Set-Environment
    Install-Chocolatey
    Install-Mkcert
    Install-NodeJS
    
    Write-Host "`nRun " -NoNewline -ForegroundColor Green
    Write-Host "npm run serve" -NoNewline -ForegroundColor White
    Write-Host " to start the app" -ForegroundColor Green
}

# Run main function
try {
    Main
}
catch {
    Write-Error "Setup failed: $_"
    exit 1
}