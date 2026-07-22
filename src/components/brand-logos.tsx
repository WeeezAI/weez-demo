// Authentic brand logos for the connector page.
// ─────────────────────────────────────────────────────────────────────────────
// lucide-react ships a genuine LinkedIn glyph but has no true multi-color marks
// for Gmail / Outlook / Google Calendar, so those use accurate inline brand
// SVGs here. Each component accepts a `className` to control its size (set
// width/height via Tailwind, e.g. `className="w-7 h-7"`).

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** LinkedIn — the official blue tile + white "in" mark. */
export function LinkedInLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LinkedIn"
    >
      <rect width="32" height="32" rx="5" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M8.42 12.6h3.3v10.5h-3.3zm1.65-5.02a1.92 1.92 0 1 1 0 3.84 1.92 1.92 0 0 1 0-3.84zM13.9 12.6h3.16v1.44h.05c.44-.83 1.52-1.7 3.12-1.7 3.34 0 3.96 2.2 3.96 5.06v5.7h-3.3v-5.05c0-1.2-.02-2.76-1.68-2.76-1.68 0-1.94 1.31-1.94 2.67v5.14H13.9z"
      />
    </svg>
  );
}

/** Gmail — the iconic multi-color envelope. */
export function GmailLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 256 193"
      className={cn("h-7 w-7", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Gmail"
    >
      <path
        fill="#4285F4"
        d="M58.182 192.05V93.14L27.507 65.077 0 49.504v130.72c0 6.65 5.399 11.826 11.826 11.826z"
      />
      <path
        fill="#34A853"
        d="M197.818 192.05h46.355c6.654 0 11.827-5.397 11.827-11.826V49.504l-58.182 43.636z"
      />
      <path
        fill="#EA4335"
        d="M58.182 93.14 128 145.504l69.818-52.364V17.504L128 69.868 58.182 17.504z"
      />
      <path
        fill="#FBBC04"
        d="M197.818 17.504V93.14L256 49.504V23.331c0-24.276-27.756-38.14-47.174-23.53z"
      />
      <path
        fill="#C5221F"
        d="M0 49.504 58.182 93.14V17.504L47.174.801C27.756-13.809 0 .055 0 23.331z"
      />
    </svg>
  );
}

/** Outlook — the blue "O" tile in front of the mail envelope. */
export function OutlookLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-7 w-7", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Outlook"
    >
      {/* envelope body (behind, to the right) */}
      <path
        d="M20 11h16.2A1.8 1.8 0 0 1 38 12.8v14.4a1.8 1.8 0 0 1-1.8 1.8H20z"
        fill="#28A8EA"
      />
      {/* envelope flap */}
      <path
        d="M20.8 13.4 29 19.2l8.2-5.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the blue "O" tile (in front, to the left) */}
      <rect x="2" y="7" width="21" height="26" rx="3.2" fill="#0F6CBD" />
      {/* the white "O" */}
      <ellipse
        cx="12.5"
        cy="20"
        rx="6"
        ry="7.2"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}

/** Google Calendar — the multi-color square with the blue "31". */
export function GoogleCalendarLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("h-7 w-7", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Calendar"
    >
      <path fill="#fff" d="M152.62 47.38H47.38v105.25h105.24z" />
      <path fill="#EA4335" d="M152.62 200 200 152.62h-47.38z" />
      <path fill="#FBBC04" d="M200 47.38h-47.38v105.24H200z" />
      <path fill="#34A853" d="M152.62 152.62H47.38V200h105.24z" />
      <path
        fill="#188038"
        d="M0 152.62v35.53A11.85 11.85 0 0 0 11.85 200h35.53v-47.38z"
      />
      <path
        fill="#1967D2"
        d="M200 47.38V11.85A11.85 11.85 0 0 0 188.15 0h-35.53v47.38z"
      />
      <path
        fill="#4285F4"
        d="M152.62 0H11.85A11.85 11.85 0 0 0 0 11.85v140.77h47.38V47.38h105.24z"
      />
      <text
        x="100"
        y="123"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="62"
        fontWeight="700"
        fill="#4285F4"
      >
        31
      </text>
    </svg>
  );
}
