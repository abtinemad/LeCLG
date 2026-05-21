const fs = require('fs');

const file = 'src/pages/Carnet.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('view === "fragments" ? (')) console.log(`[FRAGMENTS] View Start: ${i + 1}`);
    if (lines[i].includes('{cards.length > 0 && (')) console.log(`[FRAGMENTS] Box Start: ${i + 1}`);
    if (lines[i].includes('<div className="grid md:grid-cols-2 gap-6">') && i > 1700 && i < 1800) console.log(`[FRAGMENTS] Content Start: ${i + 1}`);
    if (lines[i].includes(') : view === "lien" ? (')) console.log(`[LIEN] View Start: ${i + 1}`);
    if (lines[i].includes('<div className="mb-12 bg-white/[0.02] border border-[#00f0ff]')) console.log(`cyan box: ${i + 1}`);
}
