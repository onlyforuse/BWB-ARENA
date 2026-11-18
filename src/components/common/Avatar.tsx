import { useState } from 'react';
import { AVATAR_PRESETS } from '../../data/catalog';

interface AvatarProps {
  avatarId?: string;
  avatarUrl?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  showPresence?: boolean;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
};

export function Avatar({
  avatarId = 'cyber-wolf',
  avatarUrl,
  name = 'Player',
  size = 'md',
  online,
  showPresence = false,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const preset = AVATAR_PRESETS.find((p) => p.id === avatarId) ?? AVATAR_PRESETS[0];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || preset.glyph;

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_MAP[size]}`}>
      {avatarUrl && !imgFailed ? (
        <img
          src={avatarUrl}
          alt={`${name} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full rounded-xl object-cover border border-white/15"
        />
      ) : (
        <div
          className={`w-full h-full rounded-xl bg-gradient-to-br ${preset.bg} flex items-center justify-center font-display font-bold text-white tracking-tight border border-white/15 select-none`}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
      {showPresence && typeof online === 'boolean' && (
        <span
          title={online ? 'Online' : 'Offline'}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#101426] ${
            online ? 'bg-[#22C55E]' : 'bg-slate-500'
          }`}
        />
      )}
    </div>
  );
}
