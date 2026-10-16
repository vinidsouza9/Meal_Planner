import { LoadingButton } from "@/components/Loading";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup"; reset?: "1" } => ({
    ...(s["mode"] === "signup" ? { mode: "signup" as const } : {}),
    ...(s["reset"] === "1" || s["reset"] === 1 ? { reset: "1" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — Meal Planner" },
      { name: "description", content: "Log in or create your Meal Planner account." },
      { property: "og:title", content: "Log in or sign up — Meal Planner" },
      { property: "og:description", content: "Log in or create your Meal Planner account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailZ = z.string().trim().email().max(255);

function friendly(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already exists/i.test(msg)) return "An account with this email already exists. Try logging in.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  if (/pwned|weak|compromised/i.test(msg)) return "This password is too easy to guess. Please choose another.";
  return msg;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">(search.mode === "signup" ? "up" : "in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string; confirm?: string; form?: string }>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  function switchMode(m: "in" | "up") {
    setMode(m);
    setErrs({});
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (!emailZ.safeParse(email).success) next.email = "Enter a valid email address, like you@example.com.";
    if (mode === "up") {
      if (!firstName.trim()) next.firstName = "Enter your first name.";
      if (!lastName.trim()) next.lastName = "Enter your last name.";
      if (password.length < 8) next.password = "Password must be at least 8 characters.";
      if (confirm !== password) next.confirm = "Passwords don't match.";
    } else if (!password) next.password = "Enter your password.";
    setErrs(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/plan`, data: { first_name: firstName.trim(), last_name: lastName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setSentTo(email.trim());
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      navigate({ to: "/plan" });
    } catch (err) {
      setErrs({ form: friendly(err instanceof Error ? err.message : "Something went wrong") });
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="surface p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
            <MailCheck className="size-7" />
          </span>
          <h1 className="mt-4 font-display text-3xl">Check your email to confirm</h1>
          <p className="mt-3 text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it to finish creating your account.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => { setSentTo(null); switchMode("in"); }}>
            Back to log in
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link to="/" className="font-display text-2xl text-primary">Meal Planner</Link>
      <h1 className="mt-2 font-display text-4xl">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
      {search.reset && mode === "in" && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          <CheckCircle2 className="size-4" /> Your password was updated. Log in with your new password.
        </p>
      )}
      <form onSubmit={submit} noValidate className="surface mt-6 space-y-4 p-6">
        {mode === "up" && <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="first-name">First name</Label><Input id="first-name" placeholder="First name" autoComplete="given-name" required maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-invalid={!!errs.firstName} aria-describedby="first-name-error" /><FieldError id="first-name-error">{errs.firstName}</FieldError></div>
          <div className="space-y-2"><Label htmlFor="last-name">Last name</Label><Input id="last-name" placeholder="Last name" autoComplete="family-name" required maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} aria-invalid={!!errs.lastName} aria-describedby="last-name-error" /><FieldError id="last-name-error">{errs.lastName}</FieldError></div>
        </div>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errs.email}
            aria-describedby="email-err"
            className="h-12 rounded-xl"
          />
          <FieldError id="email-err">{errs.email}</FieldError>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw">Password</Label>
            {mode === "in" && (
              <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            )}
          </div>
          <PasswordInput
            id="pw"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder={mode === "in" ? "Enter your password" : "At least 8 characters"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errs.password}
            aria-describedby="pw-rule pw-err"
          />
          {mode === "up" && <p id="pw-rule" className="text-xs text-muted-foreground">Use at least 8 characters.</p>}
          <FieldError id="pw-err">{errs.password}</FieldError>
        </div>
        {mode === "up" && (
          <div className="space-y-2">
            <Label htmlFor="pw2">Confirm password</Label>
            <PasswordInput
              id="pw2"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!errs.confirm}
              aria-describedby="pw2-err"
            />
            <FieldError id="pw2-err">{errs.confirm}</FieldError>
          </div>
        )}
        {errs.form && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errs.form}</p>
        )}
        <LoadingButton type="submit" size="lg" className="w-full" loading={busy} loadingText={mode === "in" ? "Logging in..." : "Signing up..."}>
          {mode === "in" ? "Log in" : "Sign up"}
        </LoadingButton>
      </form>
      <button type="button" onClick={() => switchMode(mode === "in" ? "up" : "in")} className="mt-6 min-h-11 text-sm font-medium text-primary">
        {mode === "in" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </main>
  );
}
