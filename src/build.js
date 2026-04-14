const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

fs.writeFileSync(path.join(distDir, 'game.build'), 'Build ID: ' + uuidv4() + ' - ' + new Date().toISOString());
//fs.writeFileSync(path.join(distDir, 'game.build'), 'Build output: ' + new Date().toISOString());

console.log('Build complete. Output written to dist/');