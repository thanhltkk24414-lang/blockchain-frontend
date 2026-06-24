import { useSocket } from '../hooks/useSocket';

interface Props {
  token: string | null;
}

export function LiveFeed({ token }: Props) {
  const { connected, feed, socketError } = useSocket(token);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Live updates</h2>
        <span className={`badge ${connected ? 'success' : 'muted'}`}>
          Socket {connected ? 'connected' : 'disconnected'}
        </span>
      </div>
      {!token && <p className="muted">Sign in to connect Socket.io and receive job:updated events.</p>}
      {socketError && <p className="error">{socketError}</p>}
      {feed.length === 0 && token && connected && (
        <p className="muted">Listening for job:updated events…</p>
      )}
      <ul className="feed-list">
        {feed.map((item) => (
          <li key={item.id} className="feed-item">
            <div className="feed-meta">
              <strong>{item.event}</strong>
              <time>{new Date(item.receivedAt).toLocaleTimeString()}</time>
            </div>
            <pre>{JSON.stringify(item.payload, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
