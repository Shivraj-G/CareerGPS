const fs = require('fs'); 
let lines = fs.readFileSync('frontend/src/main.jsx', 'utf8').split('\n'); 
for(let i=0; i<lines.length; i++) { 
  if(lines[i].includes("if (['D'].includes(validationData.classification)) return;")) { 
    lines[i] = "      if (validationData && validationData.allow_continue === false) return;"; 
  } 
  if(lines[i].includes("if (data.classification !== 'RED') {")) { 
    lines[i] = "      if (data && data.allow_continue === false) return;"; 
    lines[i+1] = "      return finish();"; 
    lines[i+2] = ""; 
  } 
} 
fs.writeFileSync('frontend/src/main.jsx', lines.join('\n'));
