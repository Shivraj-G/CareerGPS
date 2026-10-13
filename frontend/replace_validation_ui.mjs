import fs from 'fs';

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove the block condition
  content = content.replace(
    /if\s*\(\s*validationData\s*&&\s*\['RED',\s*'INVALID_GOAL'\]\.includes\(validationData\.classification\)\s*\)\s*\{\s*return;\s*\}/g,
    ""
  );

  content = content.replace(
    /\(validationData\s*&&\s*\['RED',\s*'INVALID_GOAL'\]\.includes\(validationData\.classification\)\)\s*\?\s*null\s*:\s*/g,
    ""
  );

  // Replace colors
  content = content.replace(/\['RED', 'INVALID_GOAL'\]\.includes\(validationData\.classification\)/g, "['D'].includes(validationData.classification)");
  content = content.replace(/validationData\.classification === 'YELLOW'/g, "['B', 'C'].includes(validationData.classification)");
  content = content.replace(/validationData\.classification === 'GREEN'/g, "validationData.classification === 'A'");
  content = content.replace(/validationData\.classification === 'INVALID_GOAL'/g, "validationData.classification === 'E'");
  content = content.replace(/validationData\.classification === 'RED'/g, "validationData.classification === 'D'");

  // Replace text
  content = content.replace(/<XCircle size=\{16\} \/> Invalid Goal/g, "<XCircle size={16} /> Data Missing");
  content = content.replace(/<XCircle size=\{18\} \/> Invalid Goal/g, "<XCircle size={18} /> Data Missing");
  content = content.replace(/<XCircle size=\{16\} \/> Career Conflict/g, "<XCircle size={16} /> Blocked/Ineligible");
  content = content.replace(/<XCircle size=\{18\} \/> Career Conflict/g, "<XCircle size={18} /> Blocked/Ineligible");

  // Remove block condition from validation steps
  content = content.replace(
    /if \(\['RED', 'INVALID_GOAL'\]\.includes\(validationData\.classification\)\) return;/g,
    ""
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated', filePath);
}

updateFile('./frontend/src/pages/LegacyPages.jsx');
updateFile('./frontend/src/main.jsx');
