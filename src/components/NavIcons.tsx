interface IconProps {
  className?: string;
}

// ─── Outline icons (inactive state) ──────────────────────────────────────────

export const HomeIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </svg>
);

export const HomeIconFilled = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.74 3.55a1.13 1.13 0 00-1.48 0L2.9 10.71a.75.75 0 00.98 1.13l.62-.54V20.25c0 .62.5 1.12 1.12 1.12h4.13v-4.5c0-.62.5-1.12 1.12-1.12h2.25c.62 0 1.12.5 1.12 1.12v4.5h4.13c.62 0 1.12-.5 1.12-1.12V11.3l.62.54a.75.75 0 10.98-1.13L12.74 3.55z" />
  </svg>
);

export const BoltIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
    />
  </svg>
);

export const BoltIconFilled = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.4 2.61a.75.75 0 00-.82.2l-9.5 10.19A.75.75 0 003.63 14h7.06l-1.4 7.38a.75.75 0 001.3.64l10.1-10.83a.75.75 0 00-.55-1.26h-6.43l.45-6.35a.75.75 0 00-.76-.97z" />
  </svg>
);

export const SparklesIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18l-.813-2.096a3.75 3.75 0 00-2.091-2.091L4 13l2.096-.813a3.75 3.75 0 002.091-2.091L9 8l.813 2.096a3.75 3.75 0 002.091 2.091L14 13l-2.096.813a3.75 3.75 0 00-2.091 2.091zM18.259 8.715L18 9.75l-.259-1.035a2.25 2.25 0 00-1.456-1.456L15.25 7l1.035-.259a2.25 2.25 0 001.456-1.456L18 4.25l.259 1.035a2.25 2.25 0 001.456 1.456L20.75 7l-1.035.259a2.25 2.25 0 00-1.456 1.456zM16.894 20.567L16.5 22l-.394-1.433a1.875 1.875 0 00-1.173-1.173L13.5 19l1.433-.394a1.875 1.875 0 001.173-1.173L16.5 16l.394 1.433a1.875 1.875 0 001.173 1.173L19.5 19l-1.433.394a1.875 1.875 0 00-1.173 1.173z"
    />
  </svg>
);

export const SparklesIconFilled = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 4.5a.75.75 0 01.72.55l1.06 3.71a3 3 0 001.99 2L16.5 12l-3.73 1.24a3 3 0 00-1.99 2l-1.06 3.71a.75.75 0 01-1.44 0l-1.06-3.71a3 3 0 00-1.99-2L1.5 12l3.73-1.24a3 3 0 001.99-2l1.06-3.71A.75.75 0 019 4.5zM18 3.75a.75.75 0 01.73.57l.29 1.17a2.25 2.25 0 001.57 1.57l1.16.29a.75.75 0 010 1.46l-1.16.29a2.25 2.25 0 00-1.57 1.57l-.29 1.17a.75.75 0 01-1.46 0l-.29-1.17a2.25 2.25 0 00-1.57-1.57l-1.16-.29a.75.75 0 010-1.46l1.16-.29a2.25 2.25 0 001.57-1.57l.29-1.17A.75.75 0 0118 3.75z" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export const ClockIconFilled = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.25A9.75 9.75 0 1021.75 12 9.76 9.76 0 0012 2.25zm.75 4.5a.75.75 0 00-1.5 0V12c0 .2.08.39.22.53l3.75 3.75a.75.75 0 101.06-1.06l-3.53-3.53V6.75z" />
  </svg>
);

export const BookmarkIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.25 3.75H6.75A2.25 2.25 0 004.5 6v14.25a.75.75 0 001.2.6l5.85-4.387a.75.75 0 01.9 0l5.85 4.387a.75.75 0 001.2-.6V6a2.25 2.25 0 00-2.25-2.25z"
    />
  </svg>
);

export const BookmarkIconFilled = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.75 3A2.25 2.25 0 004.5 5.25v14.62a1.13 1.13 0 001.8.9l5.7-4.28 5.7 4.28a1.13 1.13 0 001.8-.9V5.25A2.25 2.25 0 0017.25 3H6.75z" />
  </svg>
);

export const GearIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
