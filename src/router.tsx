import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { LandingPage } from '@/pages/LandingPage';
import { BrowsePage } from '@/pages/BrowsePage';
import { ClientDashboardPage } from '@/pages/ClientDashboardPage';
import { FreelancerDashboardPage } from '@/pages/FreelancerDashboardPage';
import { ArbitratorDashboardPage } from '@/pages/ArbitratorDashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { JobDetailPage } from '@/pages/JobDetailPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/browse', element: <BrowsePage /> },
      {
        path: '/client',
        element: (
          <RoleGuard requireRole="client">
            <ClientDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: '/client/jobs/:id',
        element: (
          <RoleGuard requireRole="client">
            <JobDetailPage />
          </RoleGuard>
        ),
      },
      { path: '/jobs/:id', element: <JobDetailPage /> },
      {
        path: '/freelancer',
        element: (
          <RoleGuard requireRole="freelancer">
            <FreelancerDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: '/arbitrator',
        element: (
          <RoleGuard requireArbitrator>
            <ArbitratorDashboardPage />
          </RoleGuard>
        ),
      },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
]);
