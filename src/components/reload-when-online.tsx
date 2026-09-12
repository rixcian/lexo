"use client";

import { useEffect } from "react";

/** Backs the offline page's promise to come back on its own. */
export function ReloadWhenOnline() {
  useEffect(() => {
    function reload() {
      window.location.reload();
    }

    window.addEventListener("online", reload);
    // `online` does not fire when the tab was backgrounded during the outage.
    const poll = window.setInterval(() => {
      if (navigator.onLine) reload();
    }, 5000);

    return () => {
      window.removeEventListener("online", reload);
      window.clearInterval(poll);
    };
  }, []);

  return null;
}
