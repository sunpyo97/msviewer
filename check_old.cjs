const fs = require('fs');
const content = fs.readFileSync('old_script_tmp.js', 'utf16le');
const lines = content.split('\n');
let stack = [];
for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (l.trim().startsWith('//')) continue;
    let cleanLine = l.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``');
    for (let c of cleanLine) {
        if (c === '{') stack.push(i + 1);
        if (c === '}') {
            if (stack.length > 0) stack.pop();
            else console.log('Negative at line ' + (i + 1));
        }
    }
}
console.log('Unclosed brackets in OLD script opened at lines:', stack);
