const fs = require('fs');

const file = 'src/pages/Carnet.tsx';
let txt = fs.readFileSync(file, 'utf8');

// The pattern for lien, affect, elan, matrice is generally:
// <div className="mb-12 bg-white/[0.02] border border-[#00f0ff] shadow-[0_0_25px_rgba(0,240,255,0.5)] p-6 md:p-8 rounded-lg space-y-12">
// ...
// </div>
// <div className="space-y-something..."> 
// ...
// </div>

const lines = txt.split('\n');
console.log("Lines loaded:", lines.length);

// We will find the indices of the cyan boxes:
const boxes = [];
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes('<div className="mb-12 bg-white/[0.02] border border-[#00f0ff] shadow-[0_0_25px_rgba(0,240,255,0.5)] p-6 md:p-8 rounded-lg')) {
       boxes.push(i);
   }
}
console.log("Cyan boxes found at:", boxes);
