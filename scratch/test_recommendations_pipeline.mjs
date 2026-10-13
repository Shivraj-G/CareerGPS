import { getDatabaseRecommendations } from '../backend/src/modules/recommendations/recommendation.service.js';
import { pool } from '../backend/src/config/database.js';

async function main() {
  // Find a test user or the doctor user
  const userRes = await pool.query(`SELECT id, email FROM users LIMIT 1`);
  const userId = userRes.rows[0].id;
  console.log(`Testing with user: ${userRes.rows[0].email} (${userId})\n`);

  // Test 1: Goal = "Data Analyst"
  console.log('=== TEST 1: Goal = "Data Analyst" ===');
  const res1 = await getDatabaseRecommendations(userId, 'Data Analyst', { limit: 10 });
  console.log(`Resolved Goal: ${res1.goal}`);
  console.log(`Total Candidates: ${res1.pagination.total}`);
  console.log('Top Recommendations:');
  res1.results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.match_type.toUpperCase()}] ${r.title} (Score: ${r.score}%) - ${r.reasoning}`);
  });
  console.log('\nDirect Matches:', res1.groups.direct_matches.map(r => r.title));
  console.log('Related Careers:', res1.groups.related_careers.map(r => r.title));
  console.log('Alternative Pathways:', res1.groups.alternative_pathways.map(r => r.title));

  // Test 2: Goal = "Backend Developer"
  console.log('\n=== TEST 2: Goal = "Backend Developer" ===');
  const res2 = await getDatabaseRecommendations(userId, 'Backend Developer', { limit: 10 });
  console.log(`Resolved Goal: ${res2.goal}`);
  console.log('Top Recommendations:');
  res2.results.slice(0, 5).forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.match_type.toUpperCase()}] ${r.title} (Score: ${r.score}%)`);
  });

  // Test 3: Goal = "Doctor"
  console.log('\n=== TEST 3: Goal = "Doctor" ===');
  const res3 = await getDatabaseRecommendations(userId, 'Doctor', { limit: 10 });
  console.log(`Resolved Goal: ${res3.goal}`);
  console.log('Top Recommendations:');
  res3.results.slice(0, 5).forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.match_type.toUpperCase()}] ${r.title} (Score: ${r.score}%)`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
