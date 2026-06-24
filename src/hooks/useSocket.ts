import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket, type JobUpdatedEvent } from '../lib/socket';

interface FeedItem {
  id: string;
  event: string;
  payload: JobUpdatedEvent;
  receivedAt: string;
}

export function useSocket(token: string | null) {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setConnected(false);
      setFeed([]);
      setSocketError(null);
      return;
    }

    const socket = connectSocket(token);

    const onConnect = () => {
      setConnected(true);
      setSocketError(null);
    };

    const onDisconnect = () => setConnected(false);

    const onConnectError = (err: Error) => {
      setConnected(false);
      setSocketError(err.message);
    };

    const onJobUpdated = (payload: JobUpdatedEvent) => {
      setFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          event: 'job:updated',
          payload,
          receivedAt: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('job:updated', onJobUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('job:updated', onJobUpdated);
      disconnectSocket();
    };
  }, [token]);

  return { connected, feed, socketError };
}
