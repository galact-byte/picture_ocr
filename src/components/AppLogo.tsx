import React from 'react';

interface AppLogoProps {
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ className = 'h-9 w-9' }) => (
  <svg
    className={`shrink-0 ${className}`}
    viewBox="0 0 128 128"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="6" y="6" width="116" height="116" rx="28" fill="#f3f6f9" stroke="#d8e1eb" strokeWidth="2.5" />
    <rect x="34" y="25" width="66" height="60" rx="13" fill="#bde3dc" transform="rotate(8 67 55)" />
    <rect x="26" y="38" width="68" height="62" rx="13" fill="#ffffff" stroke="#8dc8bf" strokeWidth="3" />
    <rect x="35" y="47" width="50" height="32" rx="7" fill="#4a9a92" />
    <path d="M35 72.5c8-6.5 16-8.5 24-4s16 2 26-5.5V72a7 7 0 0 1-7 7H42a7 7 0 0 1-7-6.5Z" fill="#a8ddd5" fillOpacity="0.88" />
    <circle cx="48" cy="57.5" r="4.2" fill="#eef9f7" />
    <rect x="36" y="86.5" width="22" height="4.5" rx="2.25" fill="#cde5e1" />
    <circle cx="80" cy="88.75" r="3" fill="#4a9a92" />
  </svg>
);

export default AppLogo;
