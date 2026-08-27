const fs = require('fs');

const file = 'src/pages/DailyUpdate.tsx';
let content = fs.readFileSync(file, 'utf8');

console.log("File loaded, length:", content.length);
