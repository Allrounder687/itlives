const fs = require('fs');

const html = fs.readFileSync('scratch/search_view_girl.html', 'utf8');

// Find all input and select tags
const inputs = html.match(/<input[^>]*>/gi) || [];
const selects = html.match(/<select[^>]*>[\s\S]*?<\/select>/gi) || [];

console.log('Inputs found:');
console.log(inputs);

console.log('Selects found:');
console.log(selects);
