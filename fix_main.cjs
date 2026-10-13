const fs = require('fs');
let code = fs.readFileSync('frontend/src/main.jsx', 'utf8');

// Set lastValidatedGoal early
code = code.replace(/setValidationData\(unwrapObject\(valRes\)\);\s*setLastValidatedGoal\(validationKey\);/g, 'setValidationData(unwrapObject(valRes));');
code = code.replace(/setIsValidating\(true\);/g, 'setLastValidatedGoal(validationKey);\n      setIsValidating(true);');

// Remove validationData from dependencies
code = code.replace(/, validationData\]\);/g, ']);');

// Graceful fallback for form.careerGoal.trim() if it is somehow undefined
code = code.replace(/!form.careerGoal.trim\(\)/g, '!form.careerGoal?.trim()');

fs.writeFileSync('frontend/src/main.jsx', code);
