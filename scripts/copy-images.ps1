# Create directories if they don't exist
New-Item -ItemType Directory -Force -Path "public/images"
New-Item -ItemType Directory -Force -Path "public/icons"

# Copy the Totogi logo
Copy-Item "totogi-logo.png" -Destination "public/images/totogi-logo.png" -Force

# Copy the AI assistant image
Copy-Item "ai-assistant.png" -Destination "public/images/ai-assistant.png" -Force

# Create feature icons
$apiDocsIcon = @"
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#api-gradient)" />
  <path d="M16 16H32M16 24H32M16 32H24" stroke="white" stroke-width="2" stroke-linecap="round" />
  <defs>
    <linearGradient id="api-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9747FF" />
      <stop offset="1" stop-color="#00A3FF" />
    </linearGradient>
  </defs>
</svg>
"@
$apiDocsIcon | Out-File "public/icons/api-docs.svg" -Encoding UTF8

$mappingIcon = @"
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#mapping-gradient)" />
  <path d="M16 24H32M24 16V32" stroke="white" stroke-width="2" stroke-linecap="round" />
  <circle cx="24" cy="24" r="3" fill="white" />
  <circle cx="16" cy="24" r="2" fill="white" />
  <circle cx="32" cy="24" r="2" fill="white" />
  <circle cx="24" cy="16" r="2" fill="white" />
  <circle cx="24" cy="32" r="2" fill="white" />
  <defs>
    <linearGradient id="mapping-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00A3FF" />
      <stop offset="1" stop-color="#9747FF" />
    </linearGradient>
  </defs>
</svg>
"@
$mappingIcon | Out-File "public/icons/mapping.svg" -Encoding UTF8

$aiAssistantIcon = @"
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#ai-gradient)" />
  <path d="M24 16V32M19 19L29 29M19 29L29 19" stroke="white" stroke-width="2" stroke-linecap="round" />
  <circle cx="24" cy="24" r="8" stroke="white" stroke-width="2" />
  <defs>
    <linearGradient id="ai-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF5C72" />
      <stop offset="1" stop-color="#9747FF" />
    </linearGradient>
  </defs>
</svg>
"@
$aiAssistantIcon | Out-File "public/icons/ai-assistant.svg" -Encoding UTF8

$settingsIcon = @"
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#settings-gradient)" />
  <path d="M24 16V18M24 30V32M32 24H30M18 24H16M29.657 29.657L28.243 28.243M19.757 19.757L18.343 18.343M29.657 18.343L28.243 19.757M19.757 28.243L18.343 29.657" stroke="white" stroke-width="2" stroke-linecap="round" />
  <circle cx="24" cy="24" r="4" stroke="white" stroke-width="2" />
  <defs>
    <linearGradient id="settings-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9747FF" />
      <stop offset="1" stop-color="#00A3FF" />
    </linearGradient>
  </defs>
</svg>
"@
$settingsIcon | Out-File "public/icons/settings.svg" -Encoding UTF8

Write-Host "Images and icons have been copied successfully!" 