import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
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
      { path: '/client', element: <ClientDashboardPage /> },
      { path: '/client/jobs/:id', element: <JobDetailPage /> },
      { path: '/jobs/:id', element: <JobDetailPage /> },
      { path: '/freelancer', element: <FreelancerDashboardPage /> },
      { path: '/arbitrator', element: <ArbitratorDashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
]);
