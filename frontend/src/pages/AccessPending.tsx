import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

export default function AccessPending() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Your account is ready" subtitle="Workspace access requires administrator approval.">
      <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
        <p>Your account currently has limited Member access. An administrator must assign an operational role before you can use the workspace.</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">After your access is updated, sign out and sign in again to continue.</p>
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</div>}
      <button type="button" onClick={() => void handleLogout()} disabled={busy}
        className="btn-primary mt-6 w-full justify-center disabled:cursor-wait disabled:opacity-75" style={{ minHeight: 44 }}>
        <LogOut size={16} aria-hidden="true" /> {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </AuthShell>
  );
}
