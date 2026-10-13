const fs = require('fs');
let code = fs.readFileSync('frontend/src/main.jsx', 'utf8');

// Replace the useState with a useRef
code = code.replace(/const \[lastValidatedGoal, setLastValidatedGoal\] = useState\(""\);/g, 'const lastValidatedGoalRef = useRef("");');

// In useEffect dependencies, replace lastValidatedGoal with validationData if it isn't there, or just remove it
code = code.replace(/lastValidatedGoal/g, 'lastValidatedGoalRef.current');
code = code.replace(/setLastValidatedGoalRef\.current/g, 'lastValidatedGoalRef.current = ');

// Add useRef import if not exists
if (!code.includes('useRef')) {
  code = code.replace(/useState,/, 'useState, useRef,');
}

// Fix the catch block to ignore err.code === 'CANCELLED'
code = code.replace(
  /if \(err\.name === 'AbortError' \|\| err\.code === 'TIMEOUT'\) return;/g,
  "if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.code === 'CANCELLED') return;"
);

// We should fix the setLastValidatedGoal assignment syntax
// The old script did: setLastValidatedGoal(validationKey);
// We want: lastValidatedGoalRef.current = validationKey;
code = code.replace(/lastValidatedGoalRef\.current = \(validationKey\);/g, 'lastValidatedGoalRef.current = validationKey;');

fs.writeFileSync('frontend/src/main.jsx', code);
