"use client";

import { Toaster } from "sonner";

export { toast } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      duration={8000}
      visibleToasts={3}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Notifications"
      toastOptions={{
        classNames: { toast: "lostlink-toast" },
        closeButtonAriaLabel: "Dismiss notification",
      }}
    />
  );
}
