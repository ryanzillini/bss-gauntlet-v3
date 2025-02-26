// Update Favicon Script
const fs = require('fs');
const { createCanvas } = require('canvas');
const path = require('path');

// Configuration options
const config = {
  text: 'BSS',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  shapeColor: '#4285f4',
  shape: 'circle', // 'circle', 'square', 'rounded', or 'none'
  size: 64 // favicon size in pixels
};

// Create a canvas
const canvas = createCanvas(config.size, config.size);
const ctx = canvas.getContext('2d');

// Clear canvas
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Draw background
ctx.fillStyle = config.backgroundColor;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Draw shape
ctx.fillStyle = config.shapeColor;
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const size = canvas.width * 0.8;

switch(config.shape) {
  case 'circle':
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    break;
  case 'square':
    ctx.fillRect(centerX - size/2, centerY - size/2, size, size);
    break;
  case 'rounded':
    ctx.beginPath();
    ctx.roundRect(centerX - size/2, centerY - size/2, size, size, 10);
    ctx.fill();
    break;
}

// Draw text
ctx.fillStyle = config.textColor;
ctx.font = 'bold 32px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(config.text, centerX, centerY);

// Save as PNG first (Node.js canvas doesn't directly support .ico)
const pngBuffer = canvas.toBuffer('image/png');
const pngPath = path.join(__dirname, 'favicon.png');
fs.writeFileSync(pngPath, pngBuffer);

console.log('PNG favicon created successfully.');
console.log('To convert to .ico format and replace the existing favicon:');
console.log('1. Install a tool like "png-to-ico" by running: npm install -g png-to-ico');
console.log('2. Convert PNG to ICO: png-to-ico favicon.png > public/favicon.ico');
console.log('Or use an online converter to convert favicon.png to .ico format'); 