# PowerShell script to replace favicon.ico

# Path to the favicon file
$faviconPath = "C:\Users\roger\Gauntlet_Projects\BSS - DR\BSS-gauntlet\build2\public\favicon.ico"

# Create a backup of the original favicon
$backupPath = "C:\Users\roger\Gauntlet_Projects\BSS - DR\BSS-gauntlet\build2\public\favicon_backup.ico"
if (Test-Path $faviconPath) {
    Copy-Item -Path $faviconPath -Destination $backupPath -Force
    Write-Host "Created backup of the original favicon at $backupPath"
}

# URL to a simple favicon (this is a generic one, update as needed)
$faviconUrl = "https://raw.githubusercontent.com/favicon-ingot/favicon-ingot/main/favicons/blue/favicon.ico"

# Define alternate URLs in case the first one fails
$alternateFaviconUrls = @(
    "https://www.google.com/favicon.ico",
    "https://www.microsoft.com/favicon.ico"
)

# Function to download a file from a URL
function Download-File {
    param (
        [string]$Url,
        [string]$OutputPath
    )
    
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        return $true
    } catch {
        Write-Host "Failed to download from $Url : $_"
        return $false
    }
}

# Try to download from the main URL
$success = Download-File -Url $faviconUrl -OutputPath $faviconPath

# If the main URL failed, try alternates
if (-not $success) {
    Write-Host "Trying alternate favicon sources..."
    
    foreach ($url in $alternateFaviconUrls) {
        $success = Download-File -Url $url -OutputPath $faviconPath
        if ($success) {
            Write-Host "Successfully downloaded favicon from $url"
            break
        }
    }
}

# Check if any download was successful
if ($success) {
    Write-Host "Favicon has been updated successfully at: $faviconPath"
} else {
    Write-Host "Failed to update favicon. Please try a different method."
    # Restore backup if available
    if (Test-Path $backupPath) {
        Copy-Item -Path $backupPath -Destination $faviconPath -Force
        Write-Host "Original favicon has been restored."
    }
}

# Instructions for verifying the update
Write-Host "`nTo verify the favicon has been updated:`n1. Refresh your browser`n2. You may need to clear browser cache (Ctrl+F5 in most browsers)" 