const https = require('https');
const fs = require('fs');

const url = 'https://raw.githubusercontent.com/tmforum-apis/TMF632_PartyManagement/master/TMF632_Party_Management_API_swagger.json';
const outputFile = 'tmf-party-management.json';

https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: ${response.statusCode}`);
    return;
  }

  const file = fs.createWriteStream(outputFile);
  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
}).on('error', (err) => {
  console.error('Error downloading file:', err.message);
}); 