import { Header } from './components/Header';
import { JobsList } from './components/JobsList';
import { LiveFeed } from './components/LiveFeed';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { token } = useAuth();

  return (
    <div className="app">
      <Header />
      <main className="main">
        <section className="panel">
          <h2>Jobs</h2>
          <JobsList />
        </section>
        <LiveFeed token={token} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
