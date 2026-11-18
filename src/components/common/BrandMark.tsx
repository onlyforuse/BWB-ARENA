import { useId } from 'react';

export function BrandMark({ size = 32 }: { size?: number }) {
  const gradId = `bwb-shield-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        d="M20 2.5L35 9.2V20.8C35 29.2 28.6 35.1 20 38C11.4 35.1 5 29.2 5 20.8V9.2L20 2.5Z"
        fill="#101426"
        stroke={`url(#${gradId})`}
        strokeWidth="2.4"
      />
      <path
        d="M13 13.5H21.2C23.7 13.5 25.3 14.8 25.3 16.9C25.3 18.3 24.4 19.3 23.1 19.8C24.8 20.2 26 21.5 26 23.3C26 25.7 24.1 27 21.3 27H13V13.5ZM16.8 18.7H20.3C21.3 18.7 21.9 18.2 21.9 17.4C21.9 16.6 21.3 16.2 20.3 16.2H16.8V18.7ZM16.8 24.3H20.6C21.7 24.3 22.4 23.8 22.4 22.9C22.4 22 21.7 21.5 20.6 21.5H16.8V24.3Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}
