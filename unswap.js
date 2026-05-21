import fs from 'fs';

const file = 'src/pages/Carnet.tsx';
let txt = fs.readFileSync(file, 'utf8');
let lines = txt.split('\n');

const orig_ops = [
  [ 1346, 1711, 1713, 1901 ],
  [ 1913, 2143, 2145, 2335 ],
  [ 2348, 2484, 2486, 2558 ],
  [ 2571, 2701, 2703, 2748 ],
  [ 2761, 2855, 2857, 3191 ]
];

// Let's reverse the operation!
for (const [bs, be, cs, ce] of orig_ops) {
    // In swapped form, the arrays looks like:
    // [before] + [b2 (cs to ce)] + [between (be+1 to cs-1)] + [b1 (bs to be)] + [after]
    
    let b1_len = be - bs + 1;
    let b2_len = ce - cs + 1;
    let between_len = cs - be - 1;

    let before = lines.slice(0, bs);

    let new_b2 = lines.slice(bs, bs + b2_len);
    let new_between = lines.slice(bs + b2_len, bs + b2_len + between_len);
    let new_b1 = lines.slice(bs + b2_len + between_len, bs + b2_len + between_len + b1_len);
    let after = lines.slice(bs + b2_len + between_len + b1_len);

    lines = [...before, ...new_b1, ...new_between, ...new_b2, ...after];
}

fs.writeFileSync(file, lines.join('\n'));
console.log("Unswapped successfully!");
