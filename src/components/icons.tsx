import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ArrowUpRight(props: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 12h16m-7-7 7 7-7 7" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function Asterisk(props: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="9"
      aria-hidden="true"
      {...props}
    >
      <path d="M50 4v92M4 50h92M17.5 17.5l65 65m-65 0 65-65" />
    </svg>
  );
}
