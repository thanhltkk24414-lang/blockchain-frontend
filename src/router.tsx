import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGuard } from '@/components/auth/RoleGuard';

const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const BrowsePage = lazy(() =>
  import('@/pages/BrowsePage').then((m) => ({ default: m.BrowsePage })),
);
const ClientDashboardPage = lazy(() =>
  import('@/pages/ClientDashboardPage').then((m) => ({ default: m.ClientDashboardPage })),
);
const FreelancerDashboardPage = lazy(() =>
  import('@/pages/FreelancerDashboardPage').then((m) => ({ default: m.FreelancerDashboardPage })),
);
const ArbitratorDashboardPage = lazy(() =>
  import('@/pages/ArbitratorDashboardPage').then((m) => ({ default: m.ArbitratorDashboardPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const JobDetailPage = lazy(() =>
  import('@/pages/JobDetailPage').then((m) => ({ default: m.JobDetailPage })),
);

function PageFallback() {
  return (
    <main className="page">
      <p className="muted">Loading…</p>
    </main>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: (
          <LazyPage>
            <LandingPage />
          </LazyPage>
        ),
      },
      {
        path: '/browse',
        element: (
          <LazyPage>
            <BrowsePage />
          </LazyPage>
        ),
      },
      {
        path: '/client',
        element: (
          <LazyPage>
            <RoleGuard requireRole="client">
              <ClientDashboardPage />
            </RoleGuard>
          </LazyPage>
        ),
      },
      {
        path: '/client/jobs/:id',
        element: (
          <LazyPage>
            <RoleGuard requireRole="client">
              <JobDetailPage />
            </RoleGuard>
          </LazyPage>
        ),
      },
      {
        path: '/jobs/:id',
        element: (
          <LazyPage>
            <JobDetailPage />
          </LazyPage>
        ),
      },
      {
        path: '/freelancer',
        element: (
          <LazyPage>
            <RoleGuard requireRole="freelancer">
              <FreelancerDashboardPage />
            </RoleGuard>
          </LazyPage>
        ),
      },
      {
        path: '/arbitrator',
        element: (
          <LazyPage>
            <RoleGuard requireArbitrator>
              <ArbitratorDashboardPage />
            </RoleGuard>
          </LazyPage>
        ),
      },
      {
        path: '/profile',
        element: (
          <LazyPage>
            <ProfilePage />
          </LazyPage>
        ),
      },
    ],
  },
]);
