import { pool } from '../src/config/database.js';

// Reusable normalizer
function canonicalInstitutionKey(name) {
    if (!name) return "";
    return name
        .toLowerCase()
        .replace(/[,.&-]/g, ' ')
        .replace(/\b(govt|government)\b/g, 'government')
        .replace(/\b(engg|engineering)\b/g, 'engineering')
        .replace(/\b(tech|technology)\b/g, 'technology')
        .replace(/\b(inst|institute)\b/g, 'institute')
        .replace(/\b(coll|college)\b/g, 'college')
        .replace(/\s+/g, ' ')
        .trim();
}

function canonicalCourseKey(name) {
    if (!name) return "";
    return name
        .toLowerCase()
        .replace(/[,.&-]/g, ' ')
        .replace(/\b(engg|engineering)\b/g, 'engineering')
        .replace(/\b(tech|technology)\b/g, 'technology')
        .replace(/\s+/g, ' ')
        .trim();
}

async function upsertInstitution(client, inst) {
    const key = canonicalInstitutionKey(inst.name);
    // Find existing
    const existing = await client.query(
        `SELECT id, name FROM institutions WHERE LOWER(REPLACE(REPLACE(name, '.', ''), ',', '')) ILIKE $1 OR name = $2`,
        [`%${key.split(' ')[0]}%`, inst.name]
    );

    let instId;
    
    // Attempt strict canonical match
    let match = null;
    for (const row of existing.rows) {
        if (canonicalInstitutionKey(row.name) === key) {
            match = row;
            break;
        }
    }

    if (match) {
        instId = match.id;
        // Update
        await client.query(
            `UPDATE institutions 
             SET location = COALESCE($1, location),
                 website_url = COALESCE($2, website_url),
                 record_status = 'published',
                 verification_status = 'verified',
                 updated_at = NOW()
             WHERE id = $3`,
            [inst.location || null, inst.website_url || null, instId]
        );
    } else {
        // Insert
        const res = await client.query(
            `INSERT INTO institutions (name, location, website_url, record_status, verification_status, source_url)
             VALUES ($1, $2, $3, 'published', 'verified', $4)
             RETURNING id`,
            [inst.name, inst.location || null, inst.website_url || null, inst.source_url || null]
        );
        instId = res.rows[0].id;
    }

    // Upsert courses
    if (inst.courses && inst.courses.length > 0) {
        for (const course of inst.courses) {
            const courseKey = canonicalCourseKey(course.title);
            
            // Check existing course in this institution
            const existingCourse = await client.query(
                `SELECT id FROM courses WHERE institution_id = $1 AND LOWER(REPLACE(title, '.', '')) ILIKE $2 LIMIT 1`,
                [instId, `%${courseKey.split(' ')[0]}%`]
            );
            
            let courseMatch = false;
            if (existingCourse.rows.length > 0) {
                courseMatch = true; // Simplified deduplication
            }

            if (!courseMatch) {
                await client.query(
                    `INSERT INTO courses (institution_id, title, course_type, qualification, mode, location, record_status, verification_status)
                     VALUES ($1, $2, $3, $4, 'offline', $5, 'published', 'verified')`,
                    [instId, course.title, course.type || 'Degree', course.qualification || 'UG', inst.location || null]
                );
            }
        }
    }
}

const institutionsData = [
    // UNIVERSITIES
    { name: 'Goa University', location: 'Taleigao Plateau, North Goa', type: 'University', website_url: 'https://www.unigoa.ac.in/', courses: [{title: 'M.Sc. Marine Science'}, {title: 'M.A. Portuguese'}, {title: 'MBA'}] },
    
    // ENGINEERING (DEGREE)
    { name: 'Goa College of Engineering', location: 'Farmagudi, Ponda', type: 'Engineering', website_url: 'https://gec.ac.in/', courses: [{title: 'Civil Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Computer Engineering'}, {title: 'Electrical & Electronics Engineering'}, {title: 'Electronics & Telecommunication Engineering'}, {title: 'Information Technology'}] },
    { name: 'Padre Conceicao College of Engineering', location: 'Verna, South Goa', type: 'Engineering', website_url: 'https://pccegoa.edu.in/', courses: [{title: 'Computer Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Information Technology'}, {title: 'Electronics & Telecommunication Engineering'}] },
    { name: 'Don Bosco College of Engineering', location: 'Fatorda, Margao', type: 'Engineering', website_url: 'https://dbcegoa.ac.in/', courses: [{title: 'Civil Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Computer Engineering'}, {title: 'Electronics & Telecommunication Engineering'}] },
    { name: 'Agnel Institute of Technology and Design', location: 'Assagao, Bardez', type: 'Engineering', website_url: 'https://aitdgoa.edu.in/', courses: [{title: 'Computer Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Electronics & Communications Engineering'}] },
    { name: 'Shree Rayeshwar Institute of Engineering and Information Technology', location: 'Shiroda, Ponda', type: 'Engineering', website_url: 'https://ritgoa.ac.in/', courses: [{title: 'Electronics & Telecommunication Engineering'}, {title: 'Computer Engineering'}, {title: 'Information Technology'}] },
    
    // MEDICAL & PHARMACY
    { name: 'Goa Medical College', location: 'Bambolim, North Goa', type: 'Medical', website_url: 'https://gmc.goa.gov.in/', courses: [{title: 'MBBS'}, {title: 'MD'}, {title: 'MS'}] },
    { name: 'Goa Dental College and Hospital', location: 'Bambolim, North Goa', type: 'Dental', website_url: 'https://gdch.goa.gov.in/', courses: [{title: 'BDS'}, {title: 'MDS'}] },
    { name: 'Goa College of Pharmacy', location: 'Panaji, North Goa', type: 'Pharmacy', website_url: 'https://gcp.goa.gov.in/', courses: [{title: 'B.Pharm'}, {title: 'M.Pharm'}] },
    { name: 'Institute of Nursing Education', location: 'Bambolim, North Goa', type: 'Nursing', website_url: 'https://inegoa.nic.in/', courses: [{title: 'B.Sc. Nursing'}, {title: 'M.Sc. Nursing'}, {title: 'GNM'}] },
    { name: 'Shri Kamaxidevi Homoeopathic Medical College and Hospital', location: 'Shiroda, Ponda', type: 'Homoeopathy', website_url: 'https://www.skhmc.in/', courses: [{title: 'BHMS'}] },
    
    // ARCHITECTURE & FINE ARTS
    { name: 'Goa College of Architecture', location: 'Altinho, Panaji', type: 'Architecture', website_url: 'https://gcarch.goa.gov.in/', courses: [{title: 'B.Arch'}, {title: 'M.Arch'}] },
    { name: 'Goa College of Art', location: 'Altinho, Panaji', type: 'Fine Arts', website_url: 'https://goacollegeofart.goa.gov.in/', courses: [{title: 'BFA Painting'}, {title: 'BFA Applied Art'}] },
    
    // LAW
    { name: 'V.M. Salgaocar College of Law', location: 'Miramar, Panaji', type: 'Law', website_url: 'https://vmslaw.edu.in/', courses: [{title: 'LL.B.'}, {title: 'B.A. LL.B.'}, {title: 'LL.M.'}] },
    { name: 'G.R. Kare College of Law', location: 'Margao, South Goa', type: 'Law', website_url: 'https://www.grkarelaw.edu.in/', courses: [{title: 'LL.B.'}, {title: 'B.A. LL.B.'}, {title: 'LL.M.'}] },

    // GOVT COLLEGES (DHE)
    { name: 'Government College of Arts, Science and Commerce', location: 'Sanquelim', type: 'Degree', website_url: 'https://gcascs.ac.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}] },
    { name: 'Government College of Arts, Science and Commerce', location: 'Quepem', type: 'Degree', website_url: 'https://gcq.ac.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}] },
    { name: 'Government College of Arts, Science and Commerce', location: 'Khandola', type: 'Degree', website_url: 'https://khandolacollege.edu.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}] },
    { name: 'Government College of Arts, Science & Commerce, Borda', location: 'Margao', type: 'Degree', website_url: 'https://gccem.ac.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}] },
    { name: 'Government College of Commerce & Economics', location: 'Margao', type: 'Degree', website_url: 'https://gccem.ac.in/', courses: [{title: 'B.Com.'}] },
    { name: 'Goa College of Home Science', location: 'Panaji', type: 'Degree', website_url: 'https://goacollegeofhomescience.gov.in/', courses: [{title: 'B.Sc. Home Science'}] },
    { name: 'Goa College of Music', location: 'Panaji', type: 'Degree', website_url: 'https://goacollegeofmusic.edu.in/', courses: [{title: 'B.P.A. Music'}] },
    { name: 'Sant Sohirobanath Ambiye Government College of Arts & Commerce', location: 'Virnoda, Pernem', type: 'Degree', website_url: 'https://gcp.ac.in/', courses: [{title: 'B.A.'}, {title: 'B.Com.'}] },

    // POLYTECHNICS (DIPLOMA)
    { name: 'Government Polytechnic Panaji', location: 'Altinho, Panaji', type: 'Polytechnic', website_url: 'https://gpp.goa.gov.in/', courses: [{title: 'Civil Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Electrical Engineering'}, {title: 'Electronics Engineering'}, {title: 'Computer Engineering'}, {title: 'Food Technology'}] },
    { name: 'Government Polytechnic Bicholim', location: 'Bicholim', type: 'Polytechnic', website_url: 'https://gpb.goa.gov.in/', courses: [{title: 'Civil Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Electrical Engineering'}, {title: 'Mining Engineering'}] },
    { name: 'Government Polytechnic Curchorem', location: 'Cacora, Curchorem', type: 'Polytechnic', website_url: 'https://gpc.goa.gov.in/', courses: [{title: 'Mechanical Engineering'}, {title: 'Electrical Engineering'}, {title: 'Computer Engineering'}] },
    { name: 'Agnel Polytechnic', location: 'Verna, South Goa', type: 'Polytechnic', website_url: 'https://www.agnelpolytechnic.org/', courses: [{title: 'Mechanical Engineering'}, {title: 'Automobile Engineering'}, {title: 'Computer Engineering'}, {title: 'Electronics & Communication Engineering'}] },
    { name: 'Institute of Shipbuilding Technology', location: 'Vasco da Gama', type: 'Polytechnic', website_url: 'https://isbt.ac.in/', courses: [{title: 'Shipbuilding Engineering'}, {title: 'Mechanical Engineering'}, {title: 'Electronics Engineering'}] },
    { name: 'Agnel Institute of Food Crafts & Culinary Sciences', location: 'Verna, Salcete, Goa', type: 'Polytechnic', website_url: 'https://www.aifccs.com/', courses: [{title: 'Diploma in Hotel Management'}] },
    { name: 'Guardian Angel Institute of Hotel Management and Catering Technology', location: 'Curchorem, Goa', type: 'Polytechnic', website_url: null, courses: [{title: 'Diploma in Hotel Management'}] },
    
    // AIDED / PRIVATE COLLEGES
    { name: 'Dhempe College of Arts and Science', location: 'Miramar, Panaji', type: 'Degree', website_url: 'https://www.dhempecollege.edu.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}] },
    { name: 'V.N.S. Bandekar College of Commerce', location: 'Mapusa', type: 'Degree', website_url: 'https://vnsbandekarcollege.edu.in/', courses: [{title: 'B.Com.'}, {title: 'BBA'}] },
    { name: 'S.S. Dempo College of Commerce and Economics', location: 'Bambolim', type: 'Degree', website_url: 'https://dempocollege.edu.in/', courses: [{title: 'B.Com.'}, {title: 'BBA'}] },
    { name: 'Carmel College for Women', location: 'Nuvem', type: 'Degree', website_url: 'https://carmelcollegegoa.org/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}] },
    { name: 'St. Xavier\'s College', location: 'Mapusa', type: 'Degree', website_url: 'https://xavierscollege-goa.com/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}, {title: 'B.Com.'}, {title: 'BCA'}] },
    { name: 'PES College of Arts and Sciences', location: 'Farmagudi, Ponda', type: 'Degree', website_url: 'https://pescollegaponda.edu.in/', courses: [{title: 'B.A.'}, {title: 'B.Sc.'}] },
    { name: 'Rosary College of Commerce and Arts', location: 'Navelim', type: 'Degree', website_url: 'https://rosarycollege.org/', courses: [{title: 'B.A.'}, {title: 'B.Com.'}, {title: 'BCA'}, {title: 'BBA'}] },
    { name: 'M.E.S. College of Arts and Commerce', location: 'Zuarinagar', type: 'Degree', website_url: 'https://mescollege.org/', courses: [{title: 'B.A.'}, {title: 'B.Com.'}] },
    { name: 'Shree Damodar College of Commerce and Economics', location: 'Margao', type: 'Degree', website_url: 'https://www.damodarcollege.edu.in/', courses: [{title: 'B.Com.'}, {title: 'BCA'}, {title: 'BBA'}] },
    { name: 'Fr. Agnel College of Arts and Commerce', location: 'Pilar', type: 'Degree', website_url: 'https://www.fragnelcollege.edu.in/', courses: [{title: 'B.A.'}, {title: 'B.Com.'}] },
    { name: 'Vidya Prabodhini College of Commerce, Education, Computer and Management', location: 'Porvorim', type: 'Degree', website_url: 'https://vidyaprabodhinicollege.edu.in/', courses: [{title: 'B.Com.'}, {title: 'B.A. B.Ed.'}] },
    { name: 'Narayan Zantye College of Commerce', location: 'Bicholim', type: 'Degree', website_url: 'https://zantyecollege.ac.in/', courses: [{title: 'B.Com.'}] },
    { name: 'Saraswat Vidyalaya\'s Sridora Caculo College of Commerce and Management Studies', location: 'Khorlim, Mapusa', type: 'Degree', website_url: 'https://saraswatcaculo.edu.in/', courses: [{title: 'B.Com.'}, {title: 'BBA'}] },
    { name: 'Don Bosco College', location: 'Panaji', type: 'Degree', website_url: 'https://donboscogoa.ac.in/', courses: [{title: 'BBA'}, {title: 'BCA'}, {title: 'B.A. Mass Media'}] },
    { name: 'S.E.S. College', location: 'Vasco da Gama', type: 'Degree', website_url: null, courses: [] }
];

async function run() {
    console.log("Connecting to database...");
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log(`Starting upsert for ${institutionsData.length} Goa institutions...`);
        let count = 0;
        
        for (const inst of institutionsData) {
            await upsertInstitution(client, inst);
            count++;
        }
        
        await client.query('COMMIT');
        console.log(`Successfully upserted ${count} institutions and their courses without duplication.`);
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during import:", e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
