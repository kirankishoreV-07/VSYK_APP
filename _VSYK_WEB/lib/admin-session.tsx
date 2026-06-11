"use client";

import { useEffect, useState } from "react";

const ADMIN_KEY = "vsyk_admin";

export function useAdminSession() {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ADMIN_KEY)
        : null;
    setUsername(stored);
    setIsLoading(false);
  }, []);

  const logout = () => {
    window.localStorage.removeItem(ADMIN_KEY);
    setUsername(null);
  };

  return { username, isLoading, isAuthed: !!username, logout };
}
