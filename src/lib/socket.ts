import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../config/env';

export interface JobUpdatedEvent {
  onchainJobId?: number;
  status?: string;
  clientAddress?: string;
  freelancerAddress?: string;
  source?: string;
  transactionHash?: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
