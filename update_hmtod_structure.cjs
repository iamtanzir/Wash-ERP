const fs = require('fs');

const file = 'src/pages/HMTOD.tsx';
let content = fs.readFileSync(file, 'utf8');

// We will add tabs to HMTOD.
// Let's first look at the file content again to plan the replacement.
