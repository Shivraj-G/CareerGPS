const fs = require('fs');

let content = fs.readFileSync('frontend/src/main.jsx', 'utf8');

// Replace border styling
content = content.replace(/validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*'var\(--red\)'/g, "['FORMAL_REQUIREMENT_CONFLICT', 'INVALID_GOAL', 'AMBIGUOUS_GOAL'].includes(validationData.classification) ? 'var(--red)'");

// Replace background styling
content = content.replace(/validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*'rgba\(255,0,0,0\.05\)'/g, "['FORMAL_REQUIREMENT_CONFLICT', 'INVALID_GOAL', 'AMBIGUOUS_GOAL'].includes(validationData.classification) ? 'rgba(255,0,0,0.05)'");

// Replace text color (uses same regex as border if it was var(--red))
// Actually, let's just make sure we capture it accurately.
content = content.replace(/validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*'var\(--red\)'/g, "['FORMAL_REQUIREMENT_CONFLICT', 'INVALID_GOAL', 'AMBIGUOUS_GOAL'].includes(validationData.classification) ? 'var(--red)'");

// Replace title condition
content = content.replace(/\{validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*<><XCircle size=\{18\} \/> Formal requirement conflict<\/> :/g, `{validationData.classification === 'INVALID_GOAL' ? <><XCircle size={18} /> Invalid Goal</> :\\n                           validationData.classification === 'AMBIGUOUS_GOAL' ? <><HelpCircle size={18} /> Ambiguous Goal</> :\\n                           validationData.classification === 'FORMAL_REQUIREMENT_CONFLICT' ? <><XCircle size={18} /> Formal requirement conflict</> :`);

content = content.replace(/\{validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*<><XCircle size=\{14\} \/> Formal requirement conflict<\/> :/g, `{validationData.classification === 'INVALID_GOAL' ? <><XCircle size={14} /> Invalid Goal</> :\\n                       validationData.classification === 'AMBIGUOUS_GOAL' ? <><HelpCircle size={14} /> Ambiguous Goal</> :\\n                       validationData.classification === 'FORMAL_REQUIREMENT_CONFLICT' ? <><XCircle size={14} /> Formal requirement conflict</> :`);

content = content.replace(/\{validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'\s*\?\s*<><XCircle size=\{16\} \/> Formal requirement conflict<\/> :/g, `{validationData.classification === 'INVALID_GOAL' ? <><XCircle size={16} /> Invalid Goal</> :\\n                       validationData.classification === 'AMBIGUOUS_GOAL' ? <><HelpCircle size={16} /> Ambiguous Goal</> :\\n                       validationData.classification === 'FORMAL_REQUIREMENT_CONFLICT' ? <><XCircle size={16} /> Formal requirement conflict</> :`);

// Add content blocks for INVALID and AMBIGUOUS goals (Profile and Onboarding)
const conflictBlock = `{validationData.classification === 'FORMAL_REQUIREMENT_CONFLICT' && (`;
const replaceBlock = `{validationData.classification === 'INVALID_GOAL' && (
                            <p>{validationData.reason || "Please enter a valid career or occupation."}</p>
                          )}
                          {validationData.classification === 'AMBIGUOUS_GOAL' && (
                            <p>{validationData.reason || "Could you be more specific about your career goal?"}</p>
                          )}
                          {validationData.classification === 'FORMAL_REQUIREMENT_CONFLICT' && (`;
content = content.replaceAll(conflictBlock, replaceBlock);

// Button condition replacement for onboarding
content = content.replace(/validationData\.classification === 'FORMAL_REQUIREMENT_CONFLICT'([^'])/g, "['FORMAL_REQUIREMENT_CONFLICT', 'INVALID_GOAL', 'AMBIGUOUS_GOAL'].includes(validationData.classification)$1");

fs.writeFileSync('frontend/src/main.jsx', content);
console.log('done');
