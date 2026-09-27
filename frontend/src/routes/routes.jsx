import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { FoundationPage, RoutePlaceholderPage } from '../pages/FoundationPage';

const plannedRoutes = [
  ['/', 'Foundation'],
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/onboarding', 'Onboarding'],
  ['/dashboard', 'Dashboard'],
  ['/careers', 'Career discovery'],
  ['/careers/:careerId', 'Career details'],
  ['/recommendations', 'Career recommendations'],
  ['/skills/gap', 'Skill gap analysis'],
  ['/pathways', 'Pathways'],
  ['/pathways/:pathwayId', 'Pathway details'],
  ['/opportunities', 'Opportunities'],
  ['/opportunities/:opportunityId', 'Opportunity details'],
  ['/opportunities/:opportunityId/eligibility', 'Eligibility'],
  ['/courses', 'Courses'],
  ['/courses/:courseId', 'Course details'],
  ['/institutions', 'Institutions'],
  ['/institutions/:institutionId', 'Institution details'],
  ['/profile', 'Profile'],
  ['/assistant', 'AI assistant'],
  ['/admin', 'Admin'],
  ['/admin/sources', 'Admin sources'],
  ['/admin/ingestion', 'Admin ingestion'],
  ['/admin/review-queue', 'Review queue'],
  ['/admin/review-queue/:candidateId', 'Review candidate'],
  ['/admin/audit-log', 'Audit log'],
];

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <FoundationPage /> },
      ...plannedRoutes
        .filter(([path]) => path !== '/')
        .map(([path, title]) => ({
          path,
          element: <RoutePlaceholderPage title={title} />,
        })),
    ],
  },
]);
