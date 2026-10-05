const fs = require('fs');
let code = fs.readFileSync('scripts/import_goa_institutions.js', 'utf8');

const updates = {
  'Goa University': 'https://www.unigoa.ac.in/',
  'Goa College of Engineering': 'https://gec.ac.in/',
  'Padre Conceicao College of Engineering': 'https://pccegoa.edu.in/',
  'Don Bosco College of Engineering': 'https://dbcegoa.ac.in/',
  'Agnel Institute of Technology and Design': 'https://aitdgoa.edu.in/',
  'Shree Rayeshwar Institute of Engineering and Information Technology': 'https://ritgoa.ac.in/',
  'Goa Medical College': 'https://gmc.goa.gov.in/',
  'Goa Dental College and Hospital': 'https://gdch.goa.gov.in/',
  'Goa College of Pharmacy': 'https://gcp.goa.gov.in/',
  'Institute of Nursing Education': 'https://inegoa.nic.in/',
  'Shri Kamaxidevi Homoeopathic Medical College and Hospital': 'https://www.skhmc.in/',
  'Goa College of Architecture': 'https://gcarch.goa.gov.in/',
  'Goa College of Art': 'https://goacollegeofart.goa.gov.in/',
  'V.M. Salgaocar College of Law': 'https://vmslaw.edu.in/',
  'G.R. Kare College of Law': 'https://www.grkarelaw.edu.in/',
  'Government College of Arts, Science and Commerce\', location: \'Sanquelim': 'https://gcascs.ac.in/',
  'Government College of Arts, Science and Commerce\', location: \'Quepem': 'https://gcq.ac.in/',
  'Government College of Arts, Science and Commerce\', location: \'Khandola': 'https://khandolacollege.edu.in/',
  'Government College of Commerce & Economics': 'https://gccem.ac.in/',
  'Goa College of Home Science': 'https://goacollegeofhomescience.gov.in/',
  'Goa College of Music': 'https://goacollegeofmusic.edu.in/',
  'Government Polytechnic Panaji': 'https://gpp.goa.gov.in/',
  'Government Polytechnic Bicholim': 'https://gpb.goa.gov.in/',
  'Government Polytechnic Curchorem': 'https://gpc.goa.gov.in/',
  'Agnel Polytechnic': 'https://www.agnelpolytechnic.org/',
  'Institute of Shipbuilding Technology': 'https://isbt.ac.in/',
  'Dhempe College of Arts and Science': 'https://www.dhempecollege.edu.in/',
  'V.N.S. Bandekar College of Commerce': 'https://vnsbandekarcollege.edu.in/',
  'S.S. Dempo College of Commerce and Economics': 'https://dempocollege.edu.in/',
  'Carmel College for Women': 'https://carmelcollegegoa.org/',
  'St. Xavier\\'s College': 'https://xavierscollege-goa.com/',
  'PES College of Arts and Sciences': 'https://pescollegaponda.edu.in/',
  'Rosary College of Commerce and Arts': 'https://rosarycollege.org/',
  'M.E.S. College of Arts and Commerce': 'https://mescollege.org/',
  'Shree Damodar College of Commerce and Economics': 'https://www.damodarcollege.edu.in/',
  'Fr. Agnel College of Arts and Commerce': 'https://www.fragnelcollege.edu.in/',
  'Vidya Prabodhini College': 'https://vidyaprabodhinicollege.edu.in/',
  'Narayan Zantye College of Commerce': 'https://zantyecollege.ac.in/',
  'Saraswat Vidyalaya\\'s Sridora Caculo College': 'https://saraswatcaculo.edu.in/',
  'Don Bosco College\', location: \'Panaji': 'https://donboscogoa.ac.in/'
};

for (const [name, url] of Object.entries(updates)) {
  const safeName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`({ name: '${safeName}',.*?) }`, 'g');
  code = code.replace(re, `$1, website_url: '${url}' }`);
}
fs.writeFileSync('scripts/import_goa_institutions.js', code);
