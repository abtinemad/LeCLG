import fs from 'fs';

const file = 'src/pages/Carnet.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replaceAll(
  '<div className="mb-12 bg-white/[0.02] border border-[#00f0ff]',
  '<div className="mt-12 bg-white/[0.02] border border-[#00f0ff]'
);

fs.writeFileSync(file, txt);
console.log('Margins replaced');
