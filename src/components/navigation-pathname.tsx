"use client";

import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const NavigationPathname = createContext<string | null>(null);

function PathnameObserver({ onChange }: { onChange: (pathname: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onChange(pathname), [pathname, onChange]);
  return null;
}

export function NavigationPathnameProvider({ children }: { children: ReactNode }) {
  // Observe above shared route layouts so their dev-mode navigation snapshots cannot freeze the sidebar.
  const [pathname, setPathname] = useState<string | null>(null);
  return (
    <NavigationPathname value={pathname}>
      <Suspense fallback={null}><PathnameObserver onChange={setPathname} /></Suspense>
      {children}
    </NavigationPathname>
  );
}

export function useNavigationPathname() {
  const pathname = useContext(NavigationPathname);
  const localPathname = usePathname();
  return pathname ?? localPathname;
}
