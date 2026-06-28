import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';

/** Compact live-updates indicator for the header. */
export function SocketStatusDot() {
  const { token, isAuthenticated } = useAuth();
  const { connected } = useSocket(isAuthenticated ? token : null);

  if (!isAuthenticated) return null;

  return (
    <span
      className={`socket-dot${connected ? ' socket-dot-live' : ''}`}
      title={connected ? 'Live updates connected' : 'Live updates disconnected'}
      aria-label={connected ? 'Socket connected' : 'Socket disconnected'}
    />
  );
}
