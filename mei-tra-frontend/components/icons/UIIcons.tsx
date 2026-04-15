import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

function getIconSize(size: number | string | undefined, fallback: number) {
  return size ?? fallback;
}

export function SystemIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.75v1.5M8 12.75v1.5M12.25 8h1.5M2.25 8h1.5M11.9 4.1l1.05-1.05M3.05 12.95 4.1 11.9M11.9 11.9l1.05 1.05M3.05 3.05 4.1 4.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9.9 2.1a5.9 5.9 0 1 0 4 9.8A5.7 5.7 0 0 1 9.9 2.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TextSizeIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 12.5 5.8 3.5h1.4L10 12.5M4.1 9h4.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.4 12.5V8.2M9.7 9.9h3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.8 8h10.4M8 2.25c1.6 1.4 2.5 3.53 2.5 5.75S9.6 12.35 8 13.75M8 2.25C6.4 3.65 5.5 5.78 5.5 8s.9 4.35 2.5 5.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="m3.5 8.4 2.5 2.5 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 16);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="5.1" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.2 13.2a4.8 4.8 0 0 1 9.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 24);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

export function ChevronDownIcon({ size, ...props }: IconProps) {
  const iconSize = getIconSize(size, 24);
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
