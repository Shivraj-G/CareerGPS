const fs = require('fs');
let code = fs.readFileSync('frontend/src/main.jsx', 'utf8');

// 1. Fix the ref declaration
code = code.replace(/const lastValidatedGoalRef\.currentRef = useRef\(""\);/g, 'const lastValidatedGoalRef = useRef("");');
code = code.replace(/const \[lastValidatedGoal, setLastValidatedGoal\] = useState\(""\);/g, 'const lastValidatedGoalRef = useRef("");'); // Just in case it's still there

// 2. Fix the dependency array
code = code.replace(/\[form\.careerGoal, step, lastValidatedGoalRef\.current, currentProfileContext\]/g, '[form.careerGoal, step, currentProfileContext]');
code = code.replace(/\[form\.careerGoal, step, lastValidatedGoal, currentProfileContext\]/g, '[form.careerGoal, step, currentProfileContext]');

// 3. Fix the setLastValidatedGoal inside the timer
code = code.replace(/setLastValidatedGoal\(validationKey\);/g, 'lastValidatedGoalRef.current = validationKey;');

// 4. Ensure the dependency array removal worked (if it was formatted differently)
code = code.replace(/lastValidatedGoalRef\.current,/g, '');

fs.writeFileSync('frontend/src/main.jsx', code);
