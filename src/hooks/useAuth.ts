import { useCallback, useEffect, useState } from 'react';
import { SiweMessage } from 'siwe';
import { useAccount, useSignMessage } from 'wagmi';
import {
  clearAuth,
  fetchMe,
  fetchNonce,
  getStoredToken,
  getStoredUser,
  storeAuth,
  verifySiwe,
  type AuthUser,
} from '../lib/auth';

const SIWE_STATEMENT = 'Sign in to Fapex';

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) return;

    fetchMe(stored).then((res) => {
      if (res.success && res.user) {
        setToken(stored);
        setUser(res.user);
        storeAuth(stored, res.user);
      } else {
        clearAuth();
        setToken(null);
        setUser(null);
      }
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Connect a wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nonceRes = await fetchNonce(address);
      if (!nonceRes.success || !nonceRes.nonce) {
        throw new Error(nonceRes.error || 'Failed to fetch nonce');
      }

      const message = new SiweMessage({
        domain: nonceRes.domain,
        address: nonceRes.walletAddress,
        statement: SIWE_STATEMENT,
        uri: nonceRes.appUrl,
        version: '1',
        chainId: nonceRes.chainId,
        nonce: nonceRes.nonce,
      }).prepareMessage();

      const signature = await signMessageAsync({ message });

      const verifyRes = await verifySiwe(message, signature);
      if (!verifyRes.success || !verifyRes.token || !verifyRes.user) {
        throw new Error(verifyRes.error || 'SIWE verification failed');
      }

      storeAuth(verifyRes.token, verifyRes.user);
      setToken(verifyRes.token);
      setUser(verifyRes.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  const refreshSession = useCallback(async () => {
    const stored = getStoredToken();
    if (!stored) return;
    const res = await fetchMe(stored);
    if (res.success && res.user) {
      setToken(stored);
      setUser(res.user);
      storeAuth(stored, res.user);
    }
  }, []);

  const signOut = useCallback((redirectHome = false) => {
    clearAuth();
    setToken(null);
    setUser(null);
    setError(null);
    if (redirectHome && typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }, []);

  return {
    address,
    isConnected,
    token,
    user,
    isAuthenticated,
    loading,
    error,
    signIn,
    signOut,
    refreshSession,
  };
}
