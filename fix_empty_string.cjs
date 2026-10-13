const fs = require('fs');
let code = fs.readFileSync('frontend/src/main.jsx', 'utf8');

const target = `    if (step !== 4 || !form.careerGoal?.trim()) {
      if (validationData) setValidationData(null);
      return;
    }`;

const replacement = `    if (step !== 4 || !form.careerGoal?.trim()) {
      setIsValidating(false);
      if (validationData) setValidationData(null);
      lastValidatedGoalRef.current = "";
      return;
    }`;

code = code.replace(target, replacement);

// We should also check for the AI service request cancellation on the backend.
// In backend/src/modules/profiles/profile.routes.js:
// We can add req.on('close') to abort the AI fetch.

fs.writeFileSync('frontend/src/main.jsx', code);
