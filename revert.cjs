const fs = require('fs');
let content = fs.readFileSync('src/pages/Carnet.tsx', 'utf-8');
const initialLength = content.length;
content = content.replace(/^                    \{\(.*\&\&\ \($\n/gm, '');
content = content.replace(/^                    \)\}$\n/gm, '');
fs.writeFileSync('src/pages/Carnet.tsx', content);
console.log('Removed inserts', initialLength, content.length);
