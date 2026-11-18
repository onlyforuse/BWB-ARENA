import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  FlaskConical,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { getCurrentPlayerPanelHref } from '../../lib/routing';
import { BrandMark } from '../common/BrandMark';

export function AdminAuthGate() {
  const {
    firebaseUser,
    isAuthorizedAdmin,
    signInAdmin,
    signOutAdmin,
    recheckAuthorization,
    enterSandboxMode,
  } = useAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);
  const playerPanelHref = getCurrentPlayerPanelHref();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter both your Super Admin email and password.');
      return;
    }
    setBusy(true);
    try {
      await signInAdmin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyUid = () => {
    if (!firebaseUser) return;
    navigator.clipboard?.writeText(firebaseUser.uid).catch(() => {});
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 1800);
  };

  // Signed in via Firebase Auth, but UID is not yet authorized under /admins/{uid}
  if (firebaseUser && !isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-canvas text-ink arena-ambient-dots flex flex-col justify-between p-6">
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
          <a href={playerPanelHref} className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <BrandMark size={32} />
            <span className="font-display font-bold text-lg tracking-wide text-ink">BWB ARENA</span>
          </a>
          <a
            href={playerPanelHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Player Panel</span>
          </a>
        </header>

        <main className="max-w-lg w-full mx-auto my-10">
          <div className="arena-surface rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-amber-400">Clearance Required</p>
                <h1 className="font-display text-xl font-bold text-ink">Admin Role Not Assigned</h1>
              </div>
            </div>

            <p className="text-sm text-muted leading-relaxed">
              Signed in as <span className="text-ink font-medium">{firebaseUser.email}</span>, but this account is not
              yet authorized under <code className="font-mono text-xs text-[#22D3EE]">/admins/{'{uid}'}</code> in your{' '}
              <code className="font-mono text-xs text-ink">bwb-arena</code> Realtime Database.
            </p>

            <div className="rounded-xl bg-panel border border-line p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Your Firebase Auth UID</span>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#22D3EE] hover:underline whitespace-nowrap shrink-0"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUid ? 'Copied UID' : 'Copy UID'}</span>
                </button>
              </div>
              <code className="block font-mono text-xs text-ink break-all bg-canvas rounded-lg px-3 py-2 border border-line">
                {firebaseUser.uid}
              </code>
              <p className="text-xs text-muted leading-relaxed">
                In Firebase Console → Realtime Database → Data, add node{' '}
                <code className="font-mono text-ink">admins/{firebaseUser.uid}</code> with boolean value{' '}
                <code className="font-mono text-[#22C55E]">true</code>, then click Verify Access below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void recheckAuthorization()}
                className="flex-1 min-w-[160px] h-11 px-4 rounded-xl arena-gradient-btn text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Verify Admin Access</span>
              </button>
              <button
                type="button"
                onClick={enterSandboxMode}
                className="h-11 px-4 rounded-xl bg-surface-elevated border border-line text-sm font-medium text-ink hover:border-[#8B5CF6]/50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <FlaskConical className="w-4 h-4 text-[#22D3EE]" />
                <span>Open Admin Sandbox</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="h-11 px-4 rounded-xl border border-line text-sm font-medium text-muted hover:text-ink transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="max-w-5xl w-full mx-auto text-center text-xs text-muted">
          BWB ARENA Operations Console · CREATED BY SATYAM (BWB)
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink arena-ambient-dots flex flex-col justify-between p-6">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-8">
        <a href={playerPanelHref} className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <BrandMark size={34} />
          <span className="font-display font-bold text-lg tracking-wide text-ink">BWB ARENA</span>
        </a>
        <a
          href={playerPanelHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Player Panel</span>
        </a>
      </header>

      <main className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Operations Summary */}
        <section className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-mono text-[#22D3EE]">Platform Control Plane · bwb-arena</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight">
              Super Admin Command Center
            </h1>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-xl">
              Manage players, arena economy, live multiplayer lobbies, chat moderation, announcements, tournaments,
              leaderboards, and real-time platform switches from one verified console.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="arena-surface rounded-xl p-4 space-y-1">
              <p className="text-xs text-muted">Security Model</p>
              <p className="font-display text-base font-semibold text-ink">RTDB Role Gate</p>
              <p className="text-xs text-muted">Verified against /admins/{'{uid}'}</p>
            </div>
            <div className="arena-surface rounded-xl p-4 space-y-1">
              <p className="text-xs text-muted">Accountability</p>
              <p className="font-display text-base font-semibold text-ink">Full Audit Trail</p>
              <p className="text-xs text-muted">Every mutation logged with CSV export</p>
            </div>
          </div>

          <div className="rounded-xl bg-panel border border-line p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">Explore All Admin Tools Immediately</p>
              <p className="text-xs text-muted">
                Launch the isolated local sandbox to test every operational view before adding your UID to Firebase.
              </p>
            </div>
            <button
              type="button"
              onClick={enterSandboxMode}
              className="h-10 px-4 rounded-xl bg-surface-elevated border border-line hover:border-[#22D3EE]/50 text-xs font-semibold text-ink inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <FlaskConical className="w-4 h-4 text-[#22D3EE]" />
              <span>Launch Admin Sandbox</span>
            </button>
          </div>
        </section>

        {/* Right Sign-In Form */}
        <section className="lg:col-span-6 flex items-center">
          <form onSubmit={handleLogin} className="arena-surface rounded-2xl w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-ink">Administrator Sign In</h2>
                <p className="text-xs text-muted">Firebase Authentication · Same project as Player Panel</p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="block text-xs font-medium text-muted">
                  Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@bwbarena.gg"
                  className="w-full h-11 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="block text-xs font-medium text-muted">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-11 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl arena-gradient-btn text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>{busy ? 'Verifying Credentials...' : 'Sign In to Super Admin'}</span>
            </button>

            <p className="text-xs text-muted text-center leading-relaxed">
              Only Firebase users registered with <code className="font-mono text-ink">/admins/{'{uid}'}: true</code>{' '}
              can read or mutate live database nodes.
            </p>
          </form>
        </section>
      </main>

      <footer className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted border-t border-line pt-4">
        <span>BWB ARENA · Play Together. Compete Forever.</span>
        <span>CREATED BY SATYAM (BWB)</span>
      </footer>
    </div>
  );
}
