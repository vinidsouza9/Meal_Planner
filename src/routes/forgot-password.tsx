import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Meal Planner" },
      { name: "description", content: "Get a link to reset your Meal Planner password." },
      { property: "og:title", content: "Reset your password — Meal Planner" },
      { property: "og:description", content: "Get a link to reset your Meal Planner password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!z.string().trim().email().safeParse(email).success) {
      setErr("Enter a valid email address, like you@example.com.");
      return;
    }
    setErr(undefined);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setErr(/rate limit/i.test(error.message) ? "Too many requests. Please wait a minute and try again." : error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link to="/" className="font-display text-2xl text-primary">Meal Planner</Link>
      {sent ? (
        <div className="surface mt-6 p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><MailCheck className="size-7" /></span>
          <h1 className="mt-4 font-display text-3xl">Check your email</h1>
          <p className="mt-3 text-muted-foreground">If an account exists for {email.trim()}, a reset link is on its way.</p>
          <Button asChild variant="outline" className="mt-6 w-full"><Link to="/auth">Back to log in</Link></Button>
        </div>
      ) : (
        <>
          <h1 className="mt-2 font-display text-4xl">Forgot your password?</h1>
          <p className="mt-2 text-muted-foreground">Enter your email and we'll send you a link to set a new one.</p>
          <form onSubmit={submit} noValidate className="surface mt-6 space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} aria-describedby="email-err" className="h-12 rounded-xl" />
              <FieldError id="email-err">{err}</FieldError>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          </form>
          <Link to="/auth" className="mt-6 min-h-11 text-center text-sm font-medium text-primary">Back to log in</Link>
        </>
      )}
    </main>
  );
}
