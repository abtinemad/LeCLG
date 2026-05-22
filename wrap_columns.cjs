const fs = require("fs");
let content = fs.readFileSync("src/pages/Carnet.tsx", "utf-8");

// Fix Structure Invisible -> Texture & Constellation
// Currently:
// <div className="flex-1 space-y-8">
//    {/* DISSOCIATION DETECTION */}
//    ...
// </div>
// <div className="flex-1 space-y-8 md:border-l border-white/5 md:pl-12">
//    ...

// We will replace the wrapping flex rows.

let lines = content.split('\n');

// We can just find the indices and insert the conditions to wrap the columns.
function wrapBlock(startMarker, nextSiblingMarker, condition) {
    let startIdx = lines.findIndex(l => l.includes(startMarker));
    let endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(nextSiblingMarker));

    if (startIdx !== -1 && endIdx !== -1) {
        // Find the div at the start marker
        let divIdx = -1;
        for (let i = startIdx; i >= Math.max(0, startIdx - 5); i--) {
            if (lines[i].includes('className="flex-1') || lines[i].includes('className="space-y-6"')) {
                divIdx = i;
                break;
            }
        }
        
        if (divIdx !== -1) {
            lines.splice(divIdx, 0, `                    {(${condition}) && (`);
            
            // The end is right before endIdx block. Need to find matching closing div.
            // Actually it's easier to just match opening and closing div exactly.
            let depth = 0;
            let closeIdx = -1;
            for (let i = divIdx + 1; i < lines.length; i++) {
                let openCount = (lines[i].match(/<div/g) || []).length;
                let closeCount = (lines[i].match(/<\/div>/g) || []).length;
                depth += openCount;
                depth -= closeCount;
                if (depth < 0) {
                    closeIdx = i;
                    break;
                }
            }
            if (closeIdx !== -1) {
                lines.splice(closeIdx + 1, 0, `                    )}`);
            }
        }
    }
}

// Blocks to wrap:

wrapBlock('DISSOCIATION DETECTION', 'CONSTELLATION DES PRISMES', "unlockedBlocks.lien_texture || unlockedBlocks.lien_correlation || isNextLocked('lien_texture', 'lien') || isNextLocked('lien_correlation', 'lien')");
wrapBlock('CONSTELLATION DES PRISMES - SVG', 'lien_fragilite ?', "unlockedBlocks.lien_constellation || isNextLocked('lien_constellation', 'lien')");

wrapBlock('Clusters récurrents & Signaux', 'Convergence des directions', "unlockedBlocks.elan_clusters || isNextLocked('elan_clusters', 'elan')");
wrapBlock('Convergence des directions', 'matrice_validation_songes', "unlockedBlocks.elan_direction || isNextLocked('elan_direction', 'elan')");


fs.writeFileSync("src/pages/Carnet.tsx", lines.join('\n'));
