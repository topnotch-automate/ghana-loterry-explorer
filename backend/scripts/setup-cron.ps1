# PowerShell script for setting up scheduled scraping on Windows
# 
# This script creates a scheduled task to run the scraper automatically
# 
# Usage:
#   .\scripts\setup-cron.ps1

$ErrorActionPreference = "Stop"

Write-Host "Setting up scheduled scraping with Windows Task Scheduler..." -ForegroundColor Cyan
Write-Host ""

# Get the absolute path to the project
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendDir = Join-Path $ProjectDir "backend"
$ScriptPath = Join-Path $BackendDir "src\scripts\scheduledScrape.ts"
$LogDir = Join-Path $BackendDir "logs"

# Create logs directory if it doesn't exist
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$TaskName = "GhanaLotteryScraper"
$Description = "Automatically scrape lottery draws from theb2b.com daily at 2:00 AM"

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Task '$TaskName' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove and recreate it? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Existing task removed." -ForegroundColor Green
    } else {
        Write-Host "Task creation cancelled." -ForegroundColor Yellow
        exit
    }
}

# Create the action (command to run)
$Action = New-ScheduledTaskAction -Execute "npm" `
    -Argument "run scrape:scheduled -- --max-pages 5" `
    -WorkingDirectory $BackendDir

# Create the trigger (daily at 2:00 AM)
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"

# Create the principal (run as current user)
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

# Create the settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Register the scheduled task
try {
    Register-ScheduledTask -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description $Description | Out-Null
    
    Write-Host "[SUCCESS] Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: $TaskName" -ForegroundColor Cyan
    Write-Host "Schedule: Daily at 2:00 AM" -ForegroundColor Cyan
    Write-Host "Command: npm run scrape:scheduled -- --max-pages 5" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view the task, run: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Yellow
    Write-Host "To remove the task, run: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Yellow
}
catch {
    $errorMessage = $_.Exception.Message
    Write-Host "Error creating scheduled task: $errorMessage" -ForegroundColor Red
    exit 1
}
