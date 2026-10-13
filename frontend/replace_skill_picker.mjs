import fs from 'fs';

const mainFile = 'c:/Users/Mittal Halarnekar/Desktop/CareerGPS/frontend/src/main.jsx';
const newSkillPicker = fs.readFileSync('c:/Users/Mittal Halarnekar/Desktop/CareerGPS/frontend/src/scratch_skill_picker.jsx', 'utf8');

let content = fs.readFileSync(mainFile, 'utf8');

const startIndex = content.indexOf('function SkillPicker({ userSkillIds');
const endIndex = content.indexOf('function Profile() {');

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) + newSkillPicker + '\n\n' + content.substring(endIndex);
  fs.writeFileSync(mainFile, newContent);
  console.log('Successfully replaced SkillPicker in main.jsx');
} else {
  console.error('Could not find start or end index');
}
