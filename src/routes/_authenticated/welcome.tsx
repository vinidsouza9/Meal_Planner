import { LoadingButton } from "@/components/Loading";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Meal Planner" }] }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [n, setN] = useState(2);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: u.user!.id, household_size: n, onboarded: true });
    setBusy(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    navigate({ to: "/recipes" });
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Welcome</p>
      <h1 className="mt-2 font-display text-4xl">How many people do you cook for?</h1>
      <div className="surface mt-10 flex items-center justify-between p-4">
        <Button variant="secondary" size="icon" onClick={() => setN(Math.max(1, n - 1))} aria-label="Fewer">
          <Minus />
        </Button>
        <span className="font-display text-6xl tabular-nums">{n}</span>
        <Button variant="secondary" size="icon" onClick={() => setN(Math.min(20, n + 1))} aria-label="More">
          <Plus />
        </Button>
      </div>
      <LoadingButton size="lg" className="mt-8 w-full" onClick={save} loading={busy} loadingText="Saving...">
        Continue
      </LoadingButton>
    </main>
  );
}
