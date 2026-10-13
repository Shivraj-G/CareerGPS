import { pool } from './src/config/database.js';

const skills = [
  // Computer Science & Tech
  { name: 'JavaScript', category: 'programming' },
  { name: 'Python', category: 'programming' },
  { name: 'Java', category: 'programming' },
  { name: 'C++', category: 'programming' },
  { name: 'React.js', category: 'frontend' },
  { name: 'HTML/CSS', category: 'frontend' },
  { name: 'Angular', category: 'frontend' },
  { name: 'Vue.js', category: 'frontend' },
  { name: 'Node.js', category: 'backend' },
  { name: 'Express.js', category: 'backend' },
  { name: 'Django', category: 'backend' },
  { name: 'Spring Boot', category: 'backend' },
  { name: 'PostgreSQL', category: 'databases' },
  { name: 'MongoDB', category: 'databases' },
  { name: 'MySQL', category: 'databases' },
  { name: 'SQL', category: 'databases' },
  { name: 'AWS', category: 'cloud' },
  { name: 'Docker', category: 'devops' },
  { name: 'Kubernetes', category: 'devops' },
  { name: 'Git', category: 'tools' },
  { name: 'Cybersecurity', category: 'security' },
  { name: 'Network Administration', category: 'networking' },
  { name: 'Machine Learning', category: 'AI' },
  { name: 'Deep Learning', category: 'AI' },
  { name: 'Data Analysis', category: 'data_science' },
  { name: 'Data Visualization', category: 'data_science' },
  { name: 'Software Testing', category: 'QA' },
  { name: 'System Design', category: 'architecture' },
  { name: 'Data Structures and Algorithms', category: 'programming' },
  
  // Commerce, Finance, Business
  { name: 'Accounting', category: 'finance' },
  { name: 'Financial Analysis', category: 'finance' },
  { name: 'Taxation', category: 'finance' },
  { name: 'Auditing', category: 'finance' },
  { name: 'Corporate Finance', category: 'finance' },
  { name: 'Banking Operations', category: 'finance' },
  { name: 'Economics', category: 'business' },
  { name: 'Business Administration', category: 'business' },
  { name: 'Project Management', category: 'management' },
  { name: 'Agile/Scrum', category: 'management' },
  { name: 'Marketing Strategy', category: 'marketing' },
  { name: 'Digital Marketing', category: 'marketing' },
  { name: 'SEO/SEM', category: 'marketing' },
  { name: 'Human Resources (HR)', category: 'business' },
  { name: 'Talent Acquisition', category: 'business' },
  { name: 'Entrepreneurship', category: 'business' },
  { name: 'Microsoft Excel', category: 'tools' },
  { name: 'Financial Modeling', category: 'finance' },
  
  // Arts, Humanities, Social Sciences
  { name: 'Creative Writing', category: 'arts' },
  { name: 'Copywriting', category: 'communication' },
  { name: 'Foreign Languages', category: 'languages' },
  { name: 'Translation', category: 'languages' },
  { name: 'History Research', category: 'humanities' },
  { name: 'Psychological Assessment', category: 'psychology' },
  { name: 'Counseling', category: 'psychology' },
  { name: 'Sociological Research', category: 'sociology' },
  { name: 'Public Policy Analysis', category: 'political_science' },
  { name: 'Public Speaking', category: 'communication' },
  { name: 'Journalism', category: 'media' },
  
  // Science & Research
  { name: 'Statistical Analysis', category: 'mathematics' },
  { name: 'Calculus', category: 'mathematics' },
  { name: 'Physics Analysis', category: 'science' },
  { name: 'Chemistry Laboratory', category: 'science' },
  { name: 'Microbiology', category: 'biology' },
  { name: 'Biotechnology Techniques', category: 'biology' },
  { name: 'Environmental Impact Assessment', category: 'environmental' },
  { name: 'Scientific Research', category: 'research' },
  { name: 'Data Collection', category: 'research' },
  
  // Engineering, Design, Architecture
  { name: 'Mechanical Design', category: 'engineering' },
  { name: 'CAD Software', category: 'engineering' },
  { name: 'Electrical Systems', category: 'engineering' },
  { name: 'Civil Engineering Design', category: 'engineering' },
  { name: 'Structural Analysis', category: 'engineering' },
  { name: 'Architectural Drafting', category: 'architecture' },
  { name: 'Graphic Design', category: 'design' },
  { name: 'UI/UX Design', category: 'design' },
  { name: 'Figma', category: 'design' },
  { name: 'Video Editing', category: 'media' },
  { name: 'Animation', category: 'media' },
  
  // Other Disciplines
  { name: 'Teaching/Pedagogy', category: 'education' },
  { name: 'Curriculum Development', category: 'education' },
  { name: 'Clinical Care', category: 'healthcare' },
  { name: 'Patient Assessment', category: 'healthcare' },
  { name: 'Agricultural Practices', category: 'agriculture' },
  { name: 'Hospitality Management', category: 'hospitality' },
  { name: 'Event Planning', category: 'hospitality' },
  { name: 'Legal Research', category: 'law' },
  { name: 'Contract Drafting', category: 'law' },
  
  // Geography & Geospatial
  { name: 'GIS (Geographic Information Systems)', category: 'geography' },
  { name: 'QGIS', category: 'geography' },
  { name: 'ArcGIS', category: 'geography' },
  { name: 'Cartography', category: 'geography' },
  { name: 'Remote Sensing', category: 'geography' },
  { name: 'Spatial Analysis', category: 'geography' },
  { name: 'Geospatial Data Analysis', category: 'geography' },
  { name: 'GPS and Field-Survey Methods', category: 'geography' },
  { name: 'Environmental Studies', category: 'environmental' },
  { name: 'Geography Research', category: 'research' },

  // Commerce & Finance specifics
  { name: 'Financial Reporting', category: 'finance' },
  { name: 'Bookkeeping', category: 'finance' },
  { name: 'Business Mathematics', category: 'mathematics' },
  { name: 'Cost Accounting', category: 'finance' },

  // Vocational & Transferable Soft Skills
  { name: 'Problem Solving', category: 'soft_skill' },
  { name: 'Critical Thinking', category: 'soft_skill' },
  { name: 'Team Leadership', category: 'soft_skill' },
  { name: 'Time Management', category: 'soft_skill' },
  { name: 'Communication', category: 'soft_skill' },
  { name: 'Customer Service', category: 'business' },
  { name: 'Sales', category: 'business' },
  { name: 'Negotiation', category: 'business' },
  { name: 'Adaptability', category: 'soft_skill' }
];

async function seedSkills() {
  try {
    console.log("Seeding comprehensive skills catalog...");
    let inserted = 0;
    for (const skill of skills) {
      const res = await pool.query('SELECT id FROM skills WHERE name ILIKE $1', [skill.name]);
      if (res.rows.length === 0) {
        await pool.query(
          `INSERT INTO skills (name, category, record_status, origin) VALUES ($1, $2, 'published', 'curated')`,
          [skill.name, skill.category]
        );
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} new skills successfully.`);
  } catch (err) {
    console.error("Error seeding skills:", err);
  } finally {
    pool.end();
  }
}

seedSkills();
