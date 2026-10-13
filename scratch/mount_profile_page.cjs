const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../frontend/src/main.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = 'function Profile() {';
const endMarker = '// BACKEND GAP: there is no endpoint that lists a user\'s saved items of any';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found! start:', startIndex, 'end:', endIndex);
  process.exit(1);
}

const replacement = `function Profile() {
  return (
    <AppShell>
      <ProfilePage />
    </AppShell>
  );
}

`;

const newContent = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Successfully replaced Profile component in main.jsx!');
