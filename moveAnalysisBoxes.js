const fs = require('fs');

const file = 'src/pages/Carnet.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{cards.length > 0 && (')) {
        console.log(`Fragments Start: ${i + 1}`);
    }
    if (lines[i].includes('<div className="grid md:grid-cols-2 gap-6">') && i > 1700 && i < 1800) {
        console.log(`Fragments Content Start: ${i + 1}`);
    }
    if (lines[i].includes(') : view === "lien" ? (')) {
        console.log(`Lien view start: ${i + 1}`);
    }
}
