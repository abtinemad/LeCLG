import fs from 'fs';

const file = 'src/pages/Carnet.tsx';
let txt = fs.readFileSync(file, 'utf8');
let lines = txt.split('\n');

// We need to place B1 RIGHT BEFORE the closing tag </>.
// Wait, fragments does not use <>. It uses 
// {cards.length > 0 && (...)}
// <div cards.map> ...
// In fragments, placing B1 after `<div cards.map>` is fine, as both are side-by-side elements in `<div className="space-y-6">`.

function findClosestEnd(startLine, tag) {
    for (let i = startLine; i < lines.length; i++) {
        if (lines[i].includes(tag)) {
            return i;
        }
    }
    return -1;
}

// 1. Fragments
let fragBoxS = 1346;
let fragBoxE = 1711;
let fragContentS = 1713;
let fragContentE = findClosestEnd(fragContentS, ') : view === "lien" ? (') - 2;

// 2. Lien
let lienBoxS = 1913;
let lienBoxE = 2143;
let lienContentS = 2145;
let lienContentE = findClosestEnd(lienContentS, '</>') - 1;

// 3. Affect
let affectBoxS = 2348;
let affectBoxE = 2484;
let affectContentS = 2486;
let affectContentE = findClosestEnd(affectContentS, '</>') - 1;

// 4. Elan
// Elan doesn't use <> because it's wrapped in `<div className="space-y-12">`.
// The end is before `) : (` 
let elanBoxS = 2571;
let elanBoxE = 2701;
let elanContentS = 2703;
let elanContentE = findClosestEnd(elanContentS, ') : (') - 2;

// 5. Matrice
// Matrice uses <> ? No, it doesn't. Or maybe it does? Let's check Matrice.
// Let's print out line 2760
console.log("Matrice starts at:", lines[2760]); // => ") : matriceDataAnalysis ? ("
console.log("Matrice 2761 is:", lines[2761]); // => "  <>" ! Yes it uses <> !
let matriceBoxS = 2761; 
let matriceBoxE = 2855;
let matriceContentS = 2857;
let matriceContentE = findClosestEnd(matriceContentS, '</>') - 1;

console.dir({
   fragments: [fragBoxS, fragBoxE, fragContentS, fragContentE],
   lien: [lienBoxS, lienBoxE, lienContentS, lienContentE],
   affect: [affectBoxS, affectBoxE, affectContentS, affectContentE],
   elan: [elanBoxS, elanBoxE, elanContentS, elanContentE],
   matrice: [matriceBoxS, matriceBoxE, matriceContentS, matriceContentE],
});

let ops = [
  [fragBoxS, fragBoxE, fragContentS, fragContentE],
  [lienBoxS, lienBoxE, lienContentS, lienContentE],
  [affectBoxS, affectBoxE, affectContentS, affectContentE],
  [elanBoxS, elanBoxE, elanContentS, elanContentE],
  [matriceBoxS, matriceBoxE, matriceContentS, matriceContentE],
];

let valid = true;
for (const [bs, be, cs, ce] of ops) {
  if (bs < 0 || be < 0 || cs < 0 || ce < 0 || bs >= be || cs >= ce || be >= cs) {
      console.error("Invalid bounds!", [bs, be, cs, ce]);
      valid = false;
  }
}

if (valid) {
    ops.reverse();
    for (const [bs, be, cs, ce] of ops) {
        let b1 = lines.slice(bs, be + 1);
        let b2 = lines.slice(cs, ce + 1);
        let between = lines.slice(be + 1, cs);
        let before = lines.slice(0, bs);
        let after = lines.slice(ce + 1);
        lines = [...before, ...b2, ...between, ...b1, ...after];
    }
    fs.writeFileSync(file, lines.join('\n'));
    console.log("Successfully swapped all boxes with correct ends!");
}

