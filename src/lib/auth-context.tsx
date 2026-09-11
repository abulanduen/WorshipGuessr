"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Resolver = (authorized: boolean) => void;

type AuthContextValue = {
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resolverRef = useRef<Resolver | null>(null);

  const requestPasscode = useCallback(() => {
    setOpen(true);
    setError(null);
    setValue("");
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (authorized: boolean) => {
    resolverRef.current?.(authorized);
    resolverRef.current = null;
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: value }),
      });
      if (!res.ok) {
        setError("Incorrect passcode");
        return;
      }
      settle(true);
    } catch {
      setError("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  };

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      let res = await fetch(input, init);
      if (res.status === 401) {
        const ok = await requestPasscode();
        if (!ok) return res;
        res = await fetch(input, init);
      }
      return res;
    },
    [requestPasscode]
  );

  return (
    <AuthContext.Provider value={{ authorizedFetch }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl"
          >
            <h3 className="font-display text-lg font-semibold text-ink">Setlist passcode</h3>
            <p className="mt-1 text-sm text-ink-dim">
              This action edits the shared setlist. Enter the passcode to continue.
            </p>
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-4 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => settle(false)}
                className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !value}
                className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink hover:bg-gold-bright disabled:opacity-50"
              >
                {submitting ? "Checking…" : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
