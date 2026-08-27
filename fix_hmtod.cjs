const fs = require('fs');
let content = fs.readFileSync('src/pages/HMTOD.tsx', 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync('src/pages/HMTOD.tsx', content);
