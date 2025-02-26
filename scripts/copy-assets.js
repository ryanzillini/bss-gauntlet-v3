const fs = require('fs');
const path = require('path');

// Create directories
const dirs = ['public/images', 'public/icons'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// SVG Icons
const icons = {
  'api-docs': {
    gradient: {
      id: 'api-gradient',
      stops: [
        { color: '#9747FF', offset: '0' },
        { color: '#00A3FF', offset: '1' }
      ]
    },
    content: '<path d="M16 16H32M16 24H32M16 32H24" stroke="white" stroke-width="2" stroke-linecap="round" />'
  },
  'mapping': {
    gradient: {
      id: 'mapping-gradient',
      stops: [
        { color: '#00A3FF', offset: '0' },
        { color: '#9747FF', offset: '1' }
      ]
    },
    content: `
      <path d="M16 24H32M24 16V32" stroke="white" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="24" r="3" fill="white" />
      <circle cx="16" cy="24" r="2" fill="white" />
      <circle cx="32" cy="24" r="2" fill="white" />
      <circle cx="24" cy="16" r="2" fill="white" />
      <circle cx="24" cy="32" r="2" fill="white" />
    `
  },
  'ai-assistant': {
    gradient: {
      id: 'ai-gradient',
      stops: [
        { color: '#FF5C72', offset: '0' },
        { color: '#9747FF', offset: '1' }
      ]
    },
    content: `
      <path d="M24 16V32M19 19L29 29M19 29L29 19" stroke="white" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="24" r="8" stroke="white" stroke-width="2" />
    `
  },
  'settings': {
    gradient: {
      id: 'settings-gradient',
      stops: [
        { color: '#9747FF', offset: '0' },
        { color: '#00A3FF', offset: '1' }
      ]
    },
    content: `
      <path d="M24 16V18M24 30V32M32 24H30M18 24H16M29.657 29.657L28.243 28.243M19.757 19.757L18.343 18.343M29.657 18.343L28.243 19.757M19.757 28.243L18.343 29.657" stroke="white" stroke-width="2" stroke-linecap="round" />
      <circle cx="24" cy="24" r="4" stroke="white" stroke-width="2" />
    `
  }
};

// Create SVG icons
Object.entries(icons).forEach(([name, icon]) => {
  const svg = `
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#${icon.gradient.id})" />
  ${icon.content}
  <defs>
    <linearGradient id="${icon.gradient.id}" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      ${icon.gradient.stops.map(stop => `<stop offset="${stop.offset}" stop-color="${stop.color}" />`).join('\n      ')}
    </linearGradient>
  </defs>
</svg>`;

  fs.writeFileSync(path.join('public/icons', `${name}.svg`), svg.trim());
});

// Copy images if they exist
const images = ['totogi-logo.png', 'ai-assistant.png'];
images.forEach(image => {
  const sourcePath = path.join(process.cwd(), image);
  const destPath = path.join(process.cwd(), 'public/images', image);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${image} to public/images/`);
  } else {
    console.warn(`Warning: ${image} not found in root directory`);
  }
});

console.log('Assets have been generated and copied successfully!'); 