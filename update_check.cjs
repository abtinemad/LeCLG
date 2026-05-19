const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
for(let i=128; i<=740; i++) {
  if (lines[i].indexOf('${') !== -1) {
    console.log('Line ' + (i+1) + ': ' + lines[i]);
  }
}
