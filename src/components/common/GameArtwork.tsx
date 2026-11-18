import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

interface GameArtworkProps {
  src: string;
  alt: string;
  title: string;
  className?: string;
}

export function GameArtwork({ src, alt, title, className = 'w-full h-full object-cover' }: GameArtworkProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#151B30] via-[#1b1f3b] to-[#080A12] text-muted p-4">
        <Gamepad2 className="w-8 h-8 text-[#8B5CF6]" aria-hidden="true" />
        <span className="font-display text-sm font-semibold text-ink text-center">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
