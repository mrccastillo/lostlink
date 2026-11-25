import type { SVGProps } from "react";


const paths = {
  admin: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  reports: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6",
  claims: "M12 2 4 5v6c0 5 4 8 8 11 4-3 8-6 8-11V5z M8.5 11.5l2.5 2.5 4.5-5",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-2a7 7 0 0 1 14 0v2 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 4 5",
  admins: "M12 2 4 5v6c0 5 4 8 8 11 4-3 8-6 8-11V5z M9 12l2 2 4-5",
  audit: "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5",
  pickups: "m3 7 9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5",
};

export function AdminIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
