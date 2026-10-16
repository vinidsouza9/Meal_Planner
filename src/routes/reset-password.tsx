import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldError, PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Meal Planner" },
      { name: "description", content: "Choose a new password for your Meal Planner account." },
      { property: "og:title", content: "Set a new password — Meal Planner" },
      { property: "og:description", content: "Choose a new password for your Meal Planner account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errs, setErrs] = useState<{ pw?: string; pw2?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery") || window.location.search.includes("code=");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => setReady((r) => r || (!!s.session && isRecovery) || !!s.session));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (pw.length < 8) next.pw = "Password must be at least 8 characters.";
    if (pw2 !== pw) next.pw2 = "Passwords don't match.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      setErrs({ form: /pwned|weak/i.test(error.message) ? "This password is too easy to guess. Please choose another." : error.message });
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { reset: "1" }, replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link to="/" className="font-display text-2xl text-primary">Meal Planner</Link>
      <h1 className="mt-2 font-display text-4xl">Set a new password</h1>
      {ready === false ? (
        <div className="surface mt-6 p-6">
          <p className="text-muted-foreground">This reset link is invalid or has expired.</p>
          <Button asChild className="mt-4 w-full"><Link to="/forgot-password">Request a new link</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="surface mt-6 space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="pw">New password</Label>
            <PasswordInput id="pw" autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!errs.pw} aria-describedby="pw-rule pw-err" />
            <p id="pw-rule" className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            <FieldError id="pw-err">{errs.pw}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Confirm new password</Label>
            <PasswordInput id="pw2" autoComplete="new-password" placeholder="Re-enter your password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={!!errs.pw2} aria-describedby="pw2-err" />
            <FieldError id="pw2-err">{errs.pw2}</FieldError>
          </div>
          {errs.form && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errs.form}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || ready === null}>{busy ? "Saving…" : "Save new password"}</Button>
        </form>
      )}
    </main>
  );
}
