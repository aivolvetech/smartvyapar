const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const outputPath = path.resolve(__dirname, '../paths.txt');
const content = `userData: ${app.getPath('userData')}\nlogs: ${app.getPath('logs')}\n`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Paths written to paths.txt');
process.exit(0);
