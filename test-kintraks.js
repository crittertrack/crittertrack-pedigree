const fs = require('fs');
const path = require('path');

// Minimal mock so the route module loads without mongoose
process.env.NODE_ENV = 'test';

// Read the actual CSV
const buf = fs.readFileSync(path.join('C:/Users/dbana/Downloads/Export_2026-04-11.csv'));

// Inline the same parser from kintrakRoutes.js
function parseKintrakCSV(buffer) {
    let text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = []; let row = []; let field = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
            else field += c;
        }
    }
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);
    if (rows.length < 2) return [];
    const headerCounts = {};
    const headers = rows[0].map(h => {
        h = (h || '').trim();
        if (!headerCounts[h]) { headerCounts[h] = 1; return h; }
        else { headerCounts[h]++; return `${h}_${headerCounts[h]}`; }
    });
    return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] !== undefined ? r[i] : '').trim(); });
        return obj;
    });
}

function cleanName(str) {
    if (!str) return '';
    return str.replace(/[⭐❤️★♥💙💚💛🧡💜🖤🤍🤎💗💕💞💓💘💝]/g, '').trim();
}

function assembleKintrakGeneticCode(row) {
    const locusCols = ['A Locus','B Locus','C Locus','D Locus','E Locus','P Locus','Pied','DWS','Splashed','Merle','Longhair','Satin','Rex','Rosette'];
    const parts = locusCols.map(c => (row[c] || '').trim()).filter(v => v && v !== '0' && v !== 'False' && v !== 'false');
    return parts.length ? parts.join(' ') : null;
}

function parseKintrakDate(str, format) {
    if (!str || str.trim() === '') return null;
    const s = str.trim();
    let iso;
    if (format === 'DD/MM/YYYY') {
        const parts = s.split('/');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts;
        iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    } else {
        if (s === '0000-00-00' || s === '0') return null;
        iso = s;
    }
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
}

const dataRows = parseKintrakCSV(buf);
console.log('Total animal rows parsed:', dataRows.length);
console.log('\nSample row 0 key fields:');
const r0 = dataRows[0];
console.log('  Id:', r0['Id']);
console.log('  Name:', r0['Name']);
console.log('  Call Name:', r0['Call Name']);
console.log('  Prefix:', r0['Prefix']);
console.log('  Suffix:', r0['Suffix']);
console.log('  Registration:', r0['Registration']);
console.log('  Sex:', r0['Sex']);
console.log('  Dob:', r0['Dob']);
console.log('  Deceased:', r0['Deceased']);
console.log('  Date Deceased:', r0['Date Deceased']);
console.log('  Deceased Reason:', r0['Deceased Reason']);
console.log('  Microchip:', r0['Microchip']);
console.log('  Breeder:', r0['Breeder']);
console.log('  Breeder_2:', r0['Breeder_2']);
console.log('  Breeder_3:', r0['Breeder_3']);
console.log('  Coi:', r0['Coi']);
console.log('  Genetic code:', assembleKintrakGeneticCode(r0));

// Test name construction
for (let i = 0; i < Math.min(5, dataRows.length); i++) {
    const row = dataRows[i];
    const rawName = cleanName((row['Name'] || '').trim());
    const rawCallName = cleanName((row['Call Name'] || '').trim());
    const nameParts = [rawName, rawCallName && rawCallName !== rawName ? rawCallName : ''].filter(Boolean);
    const name = nameParts.join(' ') || '(unnamed)';
    console.log(`\nRow ${i}: name="${name}" | rawName="${rawName}" | callName="${rawCallName}"`);
}

// Test date parsing
console.log('\nDate parse tests:');
console.log('  YYYY-MM-DD "2021-06-26":', parseKintrakDate('2021-06-26', 'YYYY-MM-DD'));
console.log('  empty string:', parseKintrakDate('', 'YYYY-MM-DD'));
console.log('  null:', parseKintrakDate(null, 'YYYY-MM-DD'));
