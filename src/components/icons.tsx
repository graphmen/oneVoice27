import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 20, children, ...props }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <I {...p}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10.5V20h12v-9.5" />
  </I>
);
export const IconUsers = (p: P) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M16 19a4.8 4.8 0 0 1 4.8-4" />
  </I>
);
export const IconChurch = (p: P) => (
  <I {...p}>
    <path d="M12 3v4" />
    <path d="M10 5h4" />
    <path d="M5 21V10l7-5 7 5v11" />
    <path d="M10 21v-6h4v6" />
  </I>
);
export const IconMap = (p: P) => (
  <I {...p}>
    <path d="M9 4 3 6.5v13.5L9 18l6 2.5 6-2.5V4.5L15 7 9 4z" />
    <path d="M9 4v14" />
    <path d="M15 7v13.5" />
  </I>
);
export const IconCalendar = (p: P) => (
  <I {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M8 3.5v3" />
    <path d="M16 3.5v3" />
    <path d="M3.5 9.5h17" />
  </I>
);
export const IconClipboard = (p: P) => (
  <I {...p}>
    <rect x="6" y="4.5" width="12" height="16" rx="2" />
    <path d="M9 4.5h6v2.5H9z" />
    <path d="M9 12h6" />
    <path d="M9 15.5h4" />
  </I>
);
export const IconChart = (p: P) => (
  <I {...p}>
    <path d="M4 19h16" />
    <path d="M7 16V9" />
    <path d="M12 16V6" />
    <path d="M17 16v-5" />
  </I>
);
export const IconBell = (p: P) => (
  <I {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5L20 19H4l2-2.5z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </I>
);
export const IconSettings = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a7.7 7.7 0 0 0 .1-6l-2.1-.4-1-1.8 1-2.1-2.6-1.5-1.7 1.1-2.2-.2-1.5-1.8H8.2L6.7 4.3l-1.7-1.1L2.4 4.7l1 2.1-1 1.8L.3 9a7.7 7.7 0 0 0 0 6l2.1.4 1 1.8-1 2.1 2.6 1.5 1.7-1.1 2.2.2 1.5 1.8h2.2l1.5-1.8 1.7 1.1 2.6-1.5-1-2.1 1-1.8 2.1-.4z" />
  </I>
);
export const IconShield = (p: P) => (
  <I {...p}>
    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z" />
  </I>
);
export const IconPin = (p: P) => (
  <I {...p}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </I>
);
export const IconCheck = (p: P) => (
  <I {...p}>
    <path d="M5 12.5 9.2 17 19 7" />
  </I>
);
export const IconAlert = (p: P) => (
  <I {...p}>
    <path d="M12 4 3 19h18L12 4z" />
    <path d="M12 9v5" />
    <path d="M12 16.5h.01" />
  </I>
);
export const IconLogout = (p: P) => (
  <I {...p}>
    <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h10" />
    <path d="M11 8l4 4-4 4" />
  </I>
);
export const IconPlus = (p: P) => (
  <I {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </I>
);
export const IconSearch = (p: P) => (
  <I {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16.5 16.5 21 21" />
  </I>
);
export const IconArrow = (p: P) => (
  <I {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </I>
);
export const IconBook = (p: P) => (
  <I {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 5.5v16" />
  </I>
);
export const IconSpark = (p: P) => (
  <I {...p}>
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M4.5 7.5 7.5 9" />
    <path d="M16.5 15l3 1.5" />
    <path d="M4.5 16.5 7.5 15" />
    <path d="M16.5 9l3-1.5" />
    <circle cx="12" cy="12" r="3.2" />
  </I>
);
export const IconNav = (p: P) => (
  <I {...p}>
    <path d="M4 12 20 4l-4 16-5-6-7-2z" />
  </I>
);
export const IconLayers = (p: P) => (
  <I {...p}>
    <path d="M12 4 3 8.5 12 13l9-4.5L12 4z" />
    <path d="M3 12.5 12 17l9-4.5" />
    <path d="M3 16.5 12 21l9-4.5" />
  </I>
);
export const IconMenu = (p: P) => (
  <I {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </I>
);
export const IconClose = (p: P) => (
  <I {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </I>
);
export const IconPhone = (p: P) => (
  <I {...p}>
    <path d="M7 3.5h3.2l1.2 3-2 1.4a12 12 0 0 0 6.7 6.7l1.4-2 3 1.2V17a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 5.2 2 2 0 0 1 7 3.5z" />
  </I>
);
export const IconChat = (p: P) => (
  <I {...p}>
    <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-4 4v-4H8.5A3.5 3.5 0 0 1 5 11.5z" />
  </I>
);
