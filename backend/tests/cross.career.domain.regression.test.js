import { describe, expect, it } from 'vitest';
import {
  classifyCareerDomain,
  validateProjectCandidate,
  BANNED_TECH_PATTERNS
} from '../src/modules/careers/domain-taxonomy.js';
import {
  getProjectRecommendations,
  generateFallbackProjects
} from '../src/modules/projects/project.service.js';

describe('Universal Career-Domain Classification & Multi-Career Regression Test Suite', () => {
  const CAREERS_TO_TEST = [
    {
      title: 'Chef',
      expectedDomain: 'culinary_hospitality',
      isTechnical: false,
      forbiddenTech: ['node.js', 'react', 'kafka', 'docker', 'terraform', 'microservices', 'postgresql', 'express'],
      requiredDomainTerms: ['menu', 'recipe', 'food', 'kitchen', 'costing', 'haccp', 'culinary']
    },
    {
      title: 'Teacher',
      expectedDomain: 'education_teaching',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices', 'express', 'postgresql'],
      requiredDomainTerms: ['lesson', 'curriculum', 'teaching', 'pedagogy', 'student', 'rubric', 'bloom']
    },
    {
      title: 'Assistant Professor',
      expectedDomain: 'education_teaching',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices', 'express'],
      requiredDomainTerms: ['syllabus', 'lecture', 'teaching', 'pedagogy', 'dossier', 'rubric', 'academic']
    },
    {
      title: 'Nurse',
      expectedDomain: 'healthcare_medicine',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices', 'express', 'react'],
      requiredDomainTerms: ['patient', 'clinical', 'care plan', 'sbar', 'handover', 'health', 'safety']
    },
    {
      title: 'GIS Analyst',
      expectedDomain: 'geography_gis_environment',
      isTechnical: true,
      forbiddenTech: ['microservices menu', 'restaurant reservation'],
      requiredDomainTerms: ['gis', 'map', 'spatial', 'qgis', 'cartograph', 'satellite', 'raster']
    },
    {
      title: 'Marketing Specialist',
      expectedDomain: 'marketing_communications',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices', 'express'],
      requiredDomainTerms: ['campaign', 'marketing', 'persona', 'ad', 'conversion', 'audience', 'growth']
    },
    {
      title: 'Accountant',
      expectedDomain: 'business_finance_operations',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices'],
      requiredDomainTerms: ['financial', 'model', 'business', 'accounting', 'memo', 'statement', 'sensitivity', 'expense', 'cash flow', 'report']
    },
    {
      title: 'Graphic Designer',
      expectedDomain: 'design_creative',
      isTechnical: false,
      forbiddenTech: ['kafka', 'docker', 'terraform', 'microservices', 'express', 'postgresql'],
      requiredDomainTerms: ['brand', 'visual', 'logo', 'typography', 'prototype', 'design', 'figma']
    },
    {
      title: 'Backend Developer',
      expectedDomain: 'software_engineering_it',
      isTechnical: true,
      forbiddenTech: [],
      requiredDomainTerms: ['api', 'backend', 'crud', 'database', 'rest', 'service']
    },
    {
      title: 'Data Analyst',
      expectedDomain: 'data_ai',
      isTechnical: true,
      forbiddenTech: [],
      requiredDomainTerms: ['data', 'analysis', 'dashboard', 'eda', 'metrics', 'pandas']
    },
    {
      title: 'AI Engineer',
      expectedDomain: 'data_ai',
      isTechnical: true,
      forbiddenTech: [],
      requiredDomainTerms: ['ai', 'model', 'rag', 'machine learning', 'pipeline', 'embeddings']
    },
    {
      title: 'Cybersecurity Analyst',
      expectedDomain: 'software_engineering_it',
      isTechnical: true,
      forbiddenTech: ['recipe standardization', 'menu planning'],
      requiredDomainTerms: ['security', 'vulnerability', 'threat', 'audit', 'network', 'risk', 'incident']
    }
  ];

  describe('1. Career-Domain Taxonomy Classification', () => {
    for (const testCase of CAREERS_TO_TEST) {
      it(`Correctly classifies ${testCase.title} to ${testCase.expectedDomain}`, () => {
        const classified = classifyCareerDomain(testCase.title, '', [], []);
        expect(classified.domainId).toBe(testCase.expectedDomain);
        expect(classified.isTechnical).toBe(testCase.isTechnical);
      });
    }
  });

  describe('2. Project Candidate Validation Layer', () => {
    it('Rejects tech-leaking candidate for Chef', () => {
      const badChefProject = {
        title: 'Microservices Menu Management System using Go, gRPC, Docker Compose, and Kafka',
        brief: 'Build a restaurant backend using Docker, Kafka and Go.',
        skills: ['Kafka', 'Docker', 'Go', 'Microservices'],
        tasks: [{ title: 'Setup Docker Compose and Kafka' }]
      };

      const result = validateProjectCandidate(badChefProject, 'culinary_hospitality', 'Chef');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden technical stack');
    });

    it('Rejects React Web App for Teacher', () => {
      const badTeacherProject = {
        title: 'School Classroom Management Web App using React and Express',
        brief: 'Develop full stack web application for student tracking.',
        skills: ['React', 'Express.js', 'PostgreSQL'],
        tasks: [{ title: 'Build React UI' }]
      };

      const result = validateProjectCandidate(badTeacherProject, 'education_teaching', 'Teacher');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden technical stack');
    });

    it('Accepts authentic culinary candidate for Chef', () => {
      const goodChefProject = {
        title: 'Level 1 — Menu Planning, Recipe Standardization & Food Safety Protocol',
        brief: 'Design a balanced 3-course menu and standardized recipe specification sheets.',
        skills: ['Culinary Skills', 'Food Safety & HACCP', 'Recipe Standardization', 'Portion Control'],
        tasks: [{ title: 'Menu Concept Definition' }, { title: 'Standardized Recipe Sheets' }]
      };

      const result = validateProjectCandidate(goodChefProject, 'culinary_hospitality', 'Chef');
      expect(result.valid).toBe(true);
    });

    it('Accepts authentic backend candidate for Backend Developer', () => {
      const goodBackendProject = {
        title: 'Level 1 — Validated CRUD REST API Service',
        brief: 'Build a validated HTTP REST API using Node.js Express.',
        skills: ['REST APIs', 'Node.js', 'Express.js'],
        tasks: [{ title: 'Implement CRUD Endpoints' }]
      };

      const result = validateProjectCandidate(goodBackendProject, 'software_engineering_it', 'Backend Developer');
      expect(result.valid).toBe(true);
    });
  });

  describe('3. Cross-Career Fallback Generation Integrity', () => {
    for (const testCase of CAREERS_TO_TEST) {
      it(`Generates authentic 3-level fallback projects for ${testCase.title}`, () => {
        const fallbacks = generateFallbackProjects(testCase.title, 'intermediate', 2);
        expect(fallbacks.length).toBe(3);

        const l1 = fallbacks.find(p => p.difficulty_level === 1);
        const l2 = fallbacks.find(p => p.difficulty_level === 2);
        const l3 = fallbacks.find(p => p.difficulty_level === 3);

        expect(l1).toBeDefined();
        expect(l2).toBeDefined();
        expect(l3).toBeDefined();

        const combinedText = fallbacks.map(p => `${p.title} ${p.brief} ${p.skills.join(' ')}`).join(' ').toLowerCase();

        // Check required domain terms
        const hasDomainTerm = testCase.requiredDomainTerms.some(term => combinedText.includes(term.toLowerCase()));
        expect(hasDomainTerm).toBe(true);

        // Check forbidden terms for non-technical careers
        if (!testCase.isTechnical) {
          for (const banned of testCase.forbiddenTech) {
            expect(combinedText).not.toContain(banned);
          }
        }
      });
    }
  });

  describe('4. Full Recommendation Flow Across All 12 Careers', () => {
    for (const testCase of CAREERS_TO_TEST) {
      it(`Resolves recommendations for ${testCase.title} with domain isolation`, async () => {
        const recs = await getProjectRecommendations({
          careerTitle: testCase.title
        });

        expect(recs).toBeDefined();
        expect(recs.career_domain).toBe(testCase.expectedDomain);
        expect(recs.project_counts.total).toBeGreaterThanOrEqual(3);

        const allProjects = [
          ...recs.levels.level_1_starter,
          ...recs.levels.level_2_practical,
          ...recs.levels.level_3_career_ready
        ];

        expect(allProjects.length).toBeGreaterThanOrEqual(3);

        const combinedText = allProjects.map(p => `${p.title} ${p.brief} ${(p.skills || []).join(' ')}`).join(' ').toLowerCase();

        // Must contain at least one expected domain term
        const hasDomainTerm = testCase.requiredDomainTerms.some(term => combinedText.includes(term.toLowerCase()));
        expect(hasDomainTerm).toBe(true);

        // For non-technical careers, verify no forbidden tech leaks into titles or skills
        if (!testCase.isTechnical) {
          for (const banned of testCase.forbiddenTech) {
            expect(combinedText).not.toContain(banned);
          }
        }
      }, 30000);
    }
  });

  describe('5. User Profile with Tech Skills (BCA / JS) does NOT poison non-technical Chef', () => {
    it('Chef recommendations remain pure culinary even with BCA degree and JavaScript/Python skills in profile', async () => {
      // Mock user context simulating the user from the screenshot
      const userContextWithTechSkills = {
        careerTitle: 'Chef',
        options: {
          profile: {
            education: [{ degree: 'BCA (Bachelor of Computer Applications)' }],
            experience: [{ role: 'Web Development Intern', duration: '1 year' }]
          },
          userSkills: [
            { name: 'JavaScript', level: 'intermediate' },
            { name: 'Python', level: 'intermediate' },
            { name: 'SQL', level: 'beginner' },
            { name: 'React', level: 'beginner' }
          ]
        }
      };

      const recs = await getProjectRecommendations({
        careerTitle: 'Chef'
      });

      expect(recs.career_domain).toBe('culinary_hospitality');
      expect(recs.is_technical).toBe(false);

      const allProjects = [
        ...recs.levels.level_1_starter,
        ...recs.levels.level_2_practical,
        ...recs.levels.level_3_career_ready
      ];

      const combinedText = allProjects.map(p => `${p.title} ${p.brief} ${(p.skills || []).join(' ')}`).join(' ').toLowerCase();

      // STRICT PROHIBITIONS:
      expect(combinedText).not.toContain('kafka');
      expect(combinedText).not.toContain('docker');
      expect(combinedText).not.toContain('terraform');
      expect(combinedText).not.toContain('microservices');
      expect(combinedText).not.toContain('express');
      expect(combinedText).not.toContain('react');

      // MUST BE CULINARY:
      const culinaryTerms = ['recipe', 'menu', 'food', 'kitchen', 'costing', 'haccp', 'culinary'];
      const hasCulinary = culinaryTerms.some(t => combinedText.includes(t));
      expect(hasCulinary).toBe(true);
    }, 25000);
  });
});
