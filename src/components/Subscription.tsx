import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aiUsesQuery, FREE_AI_USES } from "@/lib/ai-usage";

const OPEN_UPGRADE = "meal-planner:open-upgrade";
const AI_FINISHED = "meal-planner:ai-finished";
export const openUpgrade = () => window.dispatchEvent(new Event(OPEN_UPGRADE));
export const refreshAiUses = () => window.dispatchEvent(new Event(AI_FINISHED));

const FEATURES = ["30 AI uses every month", "Weekly plans, AI recipe imports and smart swaps", "Groceries, printing and sharing stay free"];

/** Small "2 of 3 free AI uses left" line shown near AI buttons. */
export function AiUsesNote({ className = "" }: { className?: string }) {
  const { data } = useQuery(aiUsesQuery);
  if (data === undefined) return null;
  return <p className={`text-sm text-muted-foreground ${className}`}>
    {data > 0 ? `${data} of ${FREE_AI_USES} free AI uses left` : <>No free AI uses left. <button type="button" onClick={openUpgrade} className="text-primary underline underline-offset-2">See Pro</button></>}
  </p>;
}

type Notice = null | "subscribe" | "cancel";
function NoticeDialog({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return <Dialog open={!!notice} onOpenChange={(o) => !o && onClose()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{notice === "cancel" ? "No subscription to cancel" : "Payments are coming soon"}</DialogTitle>
        <DialogDescription>
          {notice === "cancel"
            ? `You're on the free plan with ${FREE_AI_USES} AI uses, so there's nothing to cancel and you won't be charged.`
            : "We're still setting up payments, so you can't subscribe just yet. Your recipes, plans and grocery lists keep working as usual."}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter><Button onClick={onClose}>Got it</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

/** Plan card for the Account page. */
export function SubscriptionCard() {
  const { data } = useQuery(aiUsesQuery);
  const [notice, setNotice] = useState<Notice>(null);
  return <section className="space-y-4 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Your plan</h2>
      <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Free{data !== undefined ? ` · ${data} of ${FREE_AI_USES} AI uses left` : ""}</span>
    </div>
    <div className="surface space-y-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl">Meal Planner Pro</h3>
        <p><span className="text-2xl font-semibold">$4.99</span><span className="text-sm text-muted-foreground"> / month</span></p>
      </div>
      <ul className="space-y-2 text-sm">{FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" aria-hidden="true" />{f}</li>)}</ul>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setNotice("subscribe")}><Sparkles /> Subscribe</Button>
        <Button variant="outline" onClick={() => setNotice("cancel")}>Cancel subscription</Button>
      </div>
    </div>
    <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
  </section>;
}

/** Mounted once in the signed-in layout; opens when an AI action hits the free limit. */
export function UpgradeDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    const show = () => { setOpen(true); void qc.invalidateQueries({ queryKey: aiUsesQuery.queryKey }); };
    const refresh = () => void qc.invalidateQueries({ queryKey: aiUsesQuery.queryKey });
    window.addEventListener(OPEN_UPGRADE, show); window.addEventListener(AI_FINISHED, refresh);
    return () => { window.removeEventListener(OPEN_UPGRADE, show); window.removeEventListener(AI_FINISHED, refresh); };
  }, [qc]);
  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You've used your {FREE_AI_USES} free AI uses</DialogTitle>
          <DialogDescription>Upgrade to Meal Planner Pro to keep planning weeks, importing recipes and swapping meals with AI. You can still add recipes and plan by hand for free.</DialogDescription>
        </DialogHeader>
        <div className="surface space-y-3 p-4">
          <p><span className="font-display text-lg">Meal Planner Pro</span> <span className="text-muted-foreground">· $4.99 / month</span></p>
          <ul className="space-y-1.5 text-sm">{FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" aria-hidden="true" />{f}</li>)}</ul>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Not now</Button>
          <Button onClick={() => { setOpen(false); setNotice("subscribe"); }}><Sparkles /> Subscribe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
  </>;
}
