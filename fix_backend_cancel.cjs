const fs = require('fs');
let code = fs.readFileSync('backend/src/modules/profiles/profile.routes.js', 'utf8');

// 1. Update callAI signature
code = code.replace(/async function callAI\(context\) \{/g, 'async function callAI(context, parentSignal) {');

// 2. Add parent signal forwarding inside callAI
const callAiTarget = `  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);`;
const callAiReplacement = `  const controller = new AbortController();
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener('abort', () => controller.abort());
  }
  const timeout = setTimeout(() => controller.abort(), 8000);`;
code = code.replace(callAiTarget, callAiReplacement);

// 3. Update route handler to pass the signal
const routeTarget = `router.post('/me/validate-goal', async (req, res, next) => {
  try {`;
const routeReplacement = `router.post('/me/validate-goal', async (req, res, next) => {
  const reqController = new AbortController();
  req.on('aborted', () => reqController.abort());
  req.on('close', () => reqController.abort());
  try {`;
code = code.replace(routeTarget, routeReplacement);

// 4. Update the callAI invocation
const callTarget = `    // Request AI analysis
    const aiResponse = await callAI({
      goal: canonicalTitle,
      profile: profile,
      skills: skillsRes.rows,
      careers: [{ id: canonicalId, title: canonicalTitle }] // passing matched career for context
    });`;
const callReplacement = `    // Request AI analysis
    const aiResponse = await callAI({
      goal: canonicalTitle,
      profile: profile,
      skills: skillsRes.rows,
      careers: [{ id: canonicalId, title: canonicalTitle }] // passing matched career for context
    }, reqController.signal);`;
code = code.replace(callTarget, callReplacement);

fs.writeFileSync('backend/src/modules/profiles/profile.routes.js', code);
