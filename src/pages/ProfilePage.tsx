import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  checkUserExists,
  fetchUserProfile,
  registerUser,
  updateUserProfile,
  type UserProfile,
} from '@/lib/api';

export function ProfilePage() {
  const { address, isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'client' | 'freelancer' | 'arbitrator'>('freelancer');
  const [skills, setSkills] = useState('');
  const [exists, setExists] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    checkUserExists(address)
      .then((res) => {
        if (cancelled) return;
        setExists(res.exists);
        if (res.exists) {
          return fetchUserProfile(address).then((profileRes) => {
            if (!cancelled && profileRes.success) {
              setProfile(profileRes.user);
              setUsername(profileRes.user.username || '');
              setFullName(profileRes.user.profile?.fullName || '');
              setRole(profileRes.user.profile?.role || 'freelancer');
              setSkills((profileRes.user.profile?.skills || []).join(', '));
            }
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile');
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleRegister = async () => {
    if (!address || !username.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await registerUser({ walletAddress: address, username: username.trim() });
      if (res.success) {
        setExists(true);
        setMessage('Registered. Update your profile below.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await updateUserProfile({
        fullName: fullName.trim() || undefined,
        role,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (res.success) {
        setProfile(res.user || profile);
        setMessage('Profile updated.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="page-header">
        <h2>Profile</h2>
        <p className="muted">Register, set role, display name, and skills after SIWE sign-in.</p>
      </div>

      {!address && <p className="muted">Connect your wallet to manage your profile.</p>}
      {address && !isAuthenticated && (
        <p className="muted">Sign in with SIWE (header) before registering or updating profile.</p>
      )}

      {address && isAuthenticated && exists === false && (
        <section className="panel form-panel">
          <h3>Register</h3>
          <label className="field">
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <button className="btn primary" type="button" onClick={handleRegister} disabled={loading}>
            Register
          </button>
        </section>
      )}

      {address && isAuthenticated && exists !== false && (
        <section className="panel form-panel">
          <h3>{profile?.username || user?.username || 'Your profile'}</h3>
          <label className="field">
            Display name
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="field">
            Role
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="client">Client</option>
              <option value="freelancer">Freelancer</option>
              <option value="arbitrator">Arbitrator</option>
            </select>
          </label>
          <label className="field">
            Skills (comma-separated)
            <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </label>
          <button className="btn primary" type="button" onClick={handleUpdate} disabled={loading}>
            Save profile
          </button>
        </section>
      )}

      {message && <p className="badge success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
