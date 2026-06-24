import { API_URL } from '../config/env';

const TOKEN_KEY = 'fapex_jwt';
const USER_KEY = 'fapex_user';

export interface AuthUser {
  walletAddress: string;
  username?: string;
  role?: string;
  reputation?: number;
}

export interface NonceResponse {
  success: boolean;
  nonce: string;
  walletAddress: string;
  domain: string;
  appUrl: string;
  chainId: number;
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  token?: string;
  expiresIn?: string;
  user?: AuthUser;
  error?: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function fetchNonce(walletAddress: string): Promise<NonceResponse> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  return res.json();
}

export async function verifySiwe(message: string, signature: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });
  return res.json();
}

export async function fetchMe(token: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
