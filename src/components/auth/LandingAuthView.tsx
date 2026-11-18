import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Gamepad2,
  Lock,
  Mail,
  ShieldCheck,
  Trophy,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import { AVATAR_PRESETS, HERO_ARENA_IMAGE } from '../../data/catalog';
import { normalizeUsername, validateRegistrationForm } from '../../lib/gameRules';
import { checkUsernameAvailable } from '../../firebase/arenaService';
import { BrandMark } from '../common/BrandMark';
import { GameArtwork } from '../common/GameArtwork';

type AuthModalMode = 'login' | 'register' | 'reset' | null;

export function LandingAuthView() {
  const {
    games,
    platformSettings,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    enterGuestPractice,
  } = useArena();

  const [authMode, setAuthMode] = useState<AuthModalMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarId, setAvatarId] = useState<string>(AVATAR_PRESETS[0].id);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Reset password field
  const [resetEmail, setResetEmail] = useState('');

  const enabledGames = games.filter((g) => g.enabled);

  const openAuth = (mode: AuthModalMode) => {
    setServerError(null);
    setFormErrors({});
    setResetSent(false);
    setAuthMode(mode);
  };

  const handleCheckUsernameBlur = async () => {
    const clean = normalizeUsername(username);
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameChecking(true);
    const available = await checkUsernameAvailable(clean);
    setUsernameStatus(available ? 'available' : 'taken');
    setUsernameChecking(false);
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormErrors((prev) => ({ ...prev, avatar: 'Choose a PNG, JPG, or WebP image.' }));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, avatar: 'Image must be under 3 MB.' }));
      return;
    }
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.avatar;
      return next;
    });
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errors: Record<string, string> = {};
    if (!loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      errors.loginEmail = 'Enter a valid email address.';
    }
    if (!loginPassword || loginPassword.length < 6) {
      errors.loginPassword = 'Enter your password (at least 6 characters).';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await loginWithEmail(loginEmail, loginPassword);
      setAuthMode(null);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errors = validateRegistrationForm({
      fullName,
      username,
      email: regEmail,
      password: regPassword,
      confirmPassword,
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await registerWithEmail({
        fullName,
        username,
        email: regEmail,
        password: regPassword,
        avatarId,
        avatarFile,
      });
      setAuthMode(null);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setFormErrors({ resetEmail: 'Enter the email address associated with your account.' });
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      await sendPasswordReset(resetEmail);
      setResetSent(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not send password reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-wide text-ink whitespace-nowrap shrink-0"
          >
            <BrandMark size={30} />
            <span>{platformSettings.platformName}</span>
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-sm font-medium text-muted">
            <a href="#games" className="hover:text-ink transition-colors whitespace-nowrap shrink-0">
              Games
            </a>
            <a href="#arenas" className="hover:text-ink transition-colors whitespace-nowrap shrink-0">
              Multiplayer
            </a>
            <a href="#features" className="hover:text-ink transition-colors whitespace-nowrap shrink-0">
              Platform
            </a>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="arena-gradient-btn px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0"
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Stage */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0">
            <img
              src={HERO_ARENA_IMAGE}
              alt="BWB ARENA competitive stadium interior"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-55 dark:opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#080A12] via-[#080A12]/85 to-[#080A12]/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080A12] via-transparent to-transparent" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
            <div className="max-w-2xl space-y-6">
              <p className="text-xs sm:text-sm font-mono font-semibold tracking-widest uppercase text-[#22D3EE]">
                {platformSettings.tagline}
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                Compete Live in Real-Time Multiplayer Arenas
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                {platformSettings.welcomeMessage} Create private squad lobbies, challenge rivals across five
                instant-play games, and track verified XP, achievements, and seasonal rankings.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  data-start="true"
                  className="arena-gradient-btn px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Join BWB ARENA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={enterGuestPractice}
                  className="px-5 py-3.5 rounded-xl text-sm font-medium text-[#22D3EE] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
                >
                  Try Practice Arena
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs sm:text-sm text-slate-300/90">
                <span>5 Playable Games</span>
                <span aria-hidden="true">·</span>
                <span>Firebase Realtime Rooms</span>
                <span aria-hidden="true">·</span>
                <span>Mobile & Desktop Ready</span>
              </div>
            </div>
          </div>
        </section>

        {/* Playable Games Showcase */}
        <section id="games" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Playable Arena Library</h2>
              <p className="text-sm sm:text-base text-muted mt-1">
                Every title below is fully playable right now in real-time rooms or solo practice mode.
              </p>
            </div>
            <button
              type="button"
              onClick={enterGuestPractice}
              className="text-sm font-semibold text-[#8B5CF6] hover:text-[#22D3EE] transition-colors self-start sm:self-auto whitespace-nowrap"
            >
              Launch Practice Mode →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enabledGames.map((game) => (
              <article
                key={game.id}
                className="arena-surface rounded-2xl overflow-hidden flex flex-col hover:border-[#8B5CF6]/45 transition-colors"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-panel">
                  <GameArtwork
                    src={game.thumbnail}
                    alt={`${game.title} game cover artwork`}
                    title={game.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080A12]/80 via-transparent to-transparent" />
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
                    <span>{game.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {game.minPlayers}–{game.maxPlayers} Players
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{game.avgDuration}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-ink">{game.title}</h3>
                  <p className="text-sm text-muted mt-1.5 leading-relaxed flex-1">{game.description}</p>
                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-muted tabular-nums">
                      +{game.xpRewardWin} XP · +{game.coinRewardWin} Coins
                    </span>
                    <button
                      type="button"
                      onClick={() => openAuth('register')}
                      className="text-sm font-semibold text-[#22D3EE] hover:text-[#8B5CF6] transition-colors whitespace-nowrap"
                    >
                      Play Now
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Core Platform Capabilities */}
        <section id="arenas" className="border-t border-line bg-panel/50">
          <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                Engineered for Competitive Multiplayer
              </h2>
              <p className="text-sm sm:text-base text-muted mt-2">
                Connected directly to Firebase Authentication, Realtime Database, and Cloud Storage with atomic room
                transactions and real-time player synchronization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="arena-surface rounded-2xl p-6 space-y-3">
                <Users className="w-6 h-6 text-[#8B5CF6]" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-ink">Atomic Multiplayer Lobbies</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Create private code-locked rooms or open public lobbies with real-time presence, ready checks, host
                  controls, and transaction-safe capacity limits.
                </p>
              </div>
              <div className="arena-surface rounded-2xl p-6 space-y-3">
                <Trophy className="w-6 h-6 text-[#22D3EE]" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-ink">Verified Rankings & Milestones</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Track Global, Weekly, Monthly, and per-game leaderboards alongside progressive Player Levels, daily
                  challenges, and multi-tier achievements.
                </p>
              </div>
              <div className="arena-surface rounded-2xl p-6 space-y-3">
                <ShieldCheck className="w-6 h-6 text-[#3B82F6]" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-ink">Protected Fair-Play Architecture</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Unique handle reservation, rate-limited room chat with player reporting, and strict database rules
                  guarding scores, XP, and coin balances.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-line bg-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <BrandMark size={20} />
            <span className="font-display font-bold text-ink">BWB ARENA</span>
            <span aria-hidden="true">·</span>
            <span>Play Together. Compete Forever.</span>
          </div>
          <p className="font-medium text-muted">CREATED BY SATYAM (BWB)</p>
        </div>
      </footer>

      {/* Authentication Modal */}
      {authMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="arena-surface rounded-2xl w-full max-w-md p-6 relative my-auto shadow-2xl">
            <button
              type="button"
              onClick={() => openAuth(null)}
              aria-label="Close authentication modal"
              className="absolute top-4 right-4 p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <BrandMark size={28} />
              <div>
                <h2 id="auth-modal-title" className="font-display text-xl font-bold text-ink">
                  {authMode === 'login'
                    ? 'Sign In to BWB ARENA'
                    : authMode === 'register'
                      ? 'Create Player Account'
                      : 'Reset Account Password'}
                </h2>
                <p className="text-xs text-muted">Powered by Firebase Authentication</p>
              </div>
            </div>

            {authMode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-panel border border-line mb-5">
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                    authMode === 'login' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                    authMode === 'register' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3.5 py-2.5 text-xs text-[#EF4444] leading-relaxed"
              >
                {serverError}
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-muted mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="player@bwbarena.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  {formErrors.loginEmail && <p className="text-xs text-[#EF4444] mt-1">{formErrors.loginEmail}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="text-xs font-medium text-muted">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => openAuth('reset')}
                      className="text-xs font-medium text-[#22D3EE] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      id="login-password"
                      type={showLoginPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-ink"
                    >
                      {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formErrors.loginPassword && (
                    <p className="text-xs text-[#EF4444] mt-1">{formErrors.loginPassword}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 arena-gradient-btn rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* REGISTRATION FORM */}
            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-fullname" className="block text-xs font-medium text-muted mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                      <input
                        id="reg-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Satyam Sharma"
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>
                    {formErrors.fullName && <p className="text-xs text-[#EF4444] mt-1">{formErrors.fullName}</p>}
                  </div>

                  <div>
                    <label htmlFor="reg-username" className="block text-xs font-medium text-muted mb-1">
                      Unique Username
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setUsernameStatus('idle');
                      }}
                      onBlur={handleCheckUsernameBlur}
                      placeholder="satyam_bwb"
                      className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink focus:outline-none focus:border-[#8B5CF6]"
                    />
                    {usernameChecking && <p className="text-[11px] text-muted mt-1">Checking availability...</p>}
                    {usernameStatus === 'available' && !formErrors.username && (
                      <p className="text-[11px] text-[#22C55E] mt-1">Handle available</p>
                    )}
                    {usernameStatus === 'taken' && (
                      <p className="text-[11px] text-[#EF4444] mt-1">Username is already taken</p>
                    )}
                    {formErrors.username && <p className="text-xs text-[#EF4444] mt-1">{formErrors.username}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-muted mb-1">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                  />
                  {formErrors.email && <p className="text-xs text-[#EF4444] mt-1">{formErrors.email}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-medium text-muted mb-1">
                      Password
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                    />
                    {formErrors.password && <p className="text-xs text-[#EF4444] mt-1">{formErrors.password}</p>}
                  </div>

                  <div>
                    <label htmlFor="reg-confirm" className="block text-xs font-medium text-muted mb-1">
                      Confirm Password
                    </label>
                    <input
                      id="reg-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                    />
                    {formErrors.confirmPassword && (
                      <p className="text-xs text-[#EF4444] mt-1">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Profile Avatar Picker + Optional Upload */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted">Profile Avatar</span>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#22D3EE] hover:underline cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                      <input type="file" accept="image/*" onChange={handleAvatarFileSelect} className="sr-only" />
                    </label>
                  </div>
                  {avatarPreviewUrl ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-panel border border-line">
                      <img
                        src={avatarPreviewUrl}
                        alt="Selected custom avatar preview"
                        className="w-11 h-11 rounded-xl object-cover"
                      />
                      <span className="text-xs text-muted flex-1 truncate">{avatarFile?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreviewUrl('');
                        }}
                        className="text-xs text-[#EF4444] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_PRESETS.map((preset) => {
                        const selected = avatarId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setAvatarId(preset.id)}
                            aria-label={`Choose ${preset.label} avatar`}
                            className={`relative h-11 rounded-xl bg-gradient-to-br ${preset.bg} text-white font-display text-xs font-bold flex items-center justify-center border-2 transition-transform ${
                              selected ? 'border-[#22D3EE] scale-[1.03]' : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                          >
                            <span>{preset.glyph}</span>
                            {selected && (
                              <Check className="w-3.5 h-3.5 absolute top-1 right-1 text-white" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {formErrors.avatar && <p className="text-xs text-[#EF4444] mt-1">{formErrors.avatar}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 arena-gradient-btn rounded-xl text-sm font-semibold disabled:opacity-60 mt-1"
                >
                  {submitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authMode === 'reset' && (
              <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
                {resetSent ? (
                  <div className="rounded-xl border border-[#22C55E]/35 bg-[#22C55E]/10 p-4 text-sm text-ink space-y-2">
                    <p className="font-semibold text-[#22C55E]">Reset Email Dispatched</p>
                    <p className="text-xs text-muted">
                      If an account exists for <span className="text-ink font-medium">{resetEmail}</span>, a Firebase
                      password reset link is on its way.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAuth('login')}
                      className="text-xs font-semibold text-[#22D3EE] hover:underline pt-1"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted leading-relaxed">
                      Enter your registered email address and Firebase Authentication will send a secure password reset
                      link.
                    </p>
                    <div>
                      <label htmlFor="reset-email" className="block text-xs font-medium text-muted mb-1.5">
                        Account Email
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                      />
                      {formErrors.resetEmail && <p className="text-xs text-[#EF4444] mt-1">{formErrors.resetEmail}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAuth('login')}
                        className="h-11 px-4 rounded-xl border border-line text-sm font-medium text-muted hover:text-ink"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 h-11 arena-gradient-btn rounded-xl text-sm font-semibold disabled:opacity-60"
                      >
                        {submitting ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-line flex items-center justify-between text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
                Want to test games first?
              </span>
              <button
                type="button"
                onClick={() => {
                  openAuth(null);
                  enterGuestPractice();
                }}
                className="font-semibold text-[#22D3EE] hover:underline"
              >
                Practice Arena
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
