const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

fs.writeFileSync(path.join(distDir, 'game.build'), 'Build output: ' + new Date().toISOString());

console.log('Build complete. Output written to dist/');