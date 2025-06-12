const fs = require('fs');
const path = require('path');

const version = new Date().getTime();

// Atualiza manifest.json
const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version.toString();
manifest.start_url = `./?v=${version}`; // Caminho relativo
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Atualiza index.html
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
indexContent = indexContent.replace(/\?v=\d+/g, `?v=${version}`);
fs.writeFileSync(indexPath, indexContent);

// Atualiza sw.js
const swPath = path.join(__dirname, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(/CACHE_NAME = 'task-organizer-v\d+'/g, `CACHE_NAME = 'task-organizer-v${version}'`);
fs.writeFileSync(swPath, swContent);

console.log(`Versão atualizada para: ${version}`);