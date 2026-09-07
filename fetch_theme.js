const https = require('https');
https.get('https://lipikaai.com/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const classes = data.match(/class="[^"]*"/g) || [];
    const colorClasses = classes.join(' ').match(/(bg-[a-z]+-[0-9]+|text-[a-z]+-[0-9]+|border-[a-z]+-[0-9]+)/g) || [];
    const counts = {};
    colorClasses.forEach(c => counts[c] = (counts[c] || 0) + 1);
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 20);
    console.log(sorted);
  });
});
