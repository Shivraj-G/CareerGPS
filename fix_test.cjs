const fs = require('fs');
let code = fs.readFileSync('test_api.mjs', 'utf8');
code = code.replace(/\\\`Bearer \\\$\\{token\\}\\\`/g, '`Bearer ${token}`');
fs.writeFileSync('test_api.mjs', code);
