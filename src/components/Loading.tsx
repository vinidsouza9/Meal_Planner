import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Loader2, CookingPot, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const LOADING_MESSAGES = {
  plan: "Cooking up your meal plan...",
  recipe: "Reading your recipe...",
  grocery: "Making your grocery list...",
  pdf: "Getting your file ready...",
  other: "Just a moment...",
} as const;
export type LoadingTask = keyof typeof LOADING_MESSAGES;

/** After this long we swap the animation for a friendly "Try again" message. */
export const SLOW_AFTER_MS = 20_000;

/** Pot with a bobbing lid and rising steam. Static icon when reduce-motion is on. */
function CookingPotAnimation() {
  return (
    <>
      <svg viewBox="0 0 80 80" className="cook-anim size-20 text-primary motion-reduce:hidden" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path className="cook-steam cook-steam-1" d="M30 22c-3-4 3-6 0-10" />
        <path className="cook-steam cook-steam-2" d="M40 20c-3-4 3-6 0-10" />
        <path className="cook-steam cook-steam-3" d="M50 22c-3-4 3-6 0-10" />
        <g className="cook-lid">
          <path d="M18 38h44" />
          <path d="M22 38c2-6 10-9 18-9s16 3 18 9" />
          <path d="M37 29h6" />
        </g>
        <path d="M20 42h40v16a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8z" />
        <path d="M20 46h-6M60 46h6" />
      </svg>
      <CookingPot className="hidden size-14 text-primary motion-reduce:block" aria-hidden="true" />
    </>
  );
}

type LoaderProps = {
  task?: LoadingTask;
  /** Friendly error text. When set, the animation is replaced by the message and a Try again button. */
  error?: string | null;
  /** True when the request is taking longer than usual but is still running. */
  slow?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
};

/** Full-section loading state for slow actions (AI, PDFs). */
export function CookingLoader({ task = "other", error, slow, onRetry, onCancel, className }: LoaderProps) {
  return (
    <div className={cn("surface flex flex-col items-center justify-center gap-4 px-6 py-12 text-center", className)} role="status" aria-live="polite">
      {error ? (
        <>
          <CookingPot className="size-12 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm font-medium">{error}</p>
          <div className="flex gap-2">
            {onCancel && <Button variant="outline" onClick={onCancel}>Go back</Button>}
            {onRetry && <Button onClick={onRetry}><RotateCcw /> Try again</Button>}
          </div>
        </>
      ) : (
        <>
          <CookingPotAnimation />
          <p className="text-muted-foreground">{LOADING_MESSAGES[task]}</p>
          {slow && <p className="text-sm text-muted-foreground">Taking a little longer than usual — hang tight, we're still working on it.</p>}
        </>
      )}
    </div>
  );
}

type SlowState = { status: "idle" | "loading" | "error"; error: string | null };

/**
 * Runs a slow action and tracks loading / error / "taking too long" state.
 * The request itself is never aborted — if it finishes after the slow notice, its result still applies.
 */
export function useSlowAction(slowMessage = "This is taking longer than usual. Please try again.") {
  const [state, setState] = useState<SlowState>({ status: "idle", error: null });
  const last = useRef<(() => Promise<unknown>) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    last.current = fn;
    const id = ++runId.current;
    setState({ status: "loading", error: null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (runId.current === id) setState({ status: "error", error: slowMessage });
    }, SLOW_AFTER_MS);
    try {
      const out = await fn();
      if (runId.current === id) setState({ status: "idle", error: null });
      return out;
    } catch (e) {
      if (runId.current === id) setState({ status: "error", error: friendlyError(e) });
      return undefined;
    } finally {
      if (runId.current === id && timer.current) clearTimeout(timer.current);
    }
  }, [slowMessage]);

  const retry = useCallback(() => { if (last.current) void run(last.current); }, [run]);
  const reset = useCallback(() => { runId.current++; setState({ status: "idle", error: null }); }, []);

  return { ...state, active: state.status !== "idle", run, retry, reset };
}

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || /fetch|network|500|internal/i.test(msg)) return "Something went wrong on our side. Please try again.";
  return msg;
}

/** Button with an inline spinner; disabled and relabelled while loading. */
export function LoadingButton({ loading, loadingText, children, disabled, ...props }: ComponentProps<typeof Button> & { loading?: boolean; loadingText?: string }) {
  return (
    <Button {...props} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <><Loader2 className="animate-spin" aria-hidden="true" /><span aria-live="polite">{loadingText ?? "Please wait..."}</span></> : children}
    </Button>
  );
}

export function RecipeCardsSkeleton() {
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading recipes">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="surface overflow-hidden">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PlanGridSkeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Loading plan">
      <Skeleton className="h-8 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-20" />
            {[0, 1, 2].map((j) => <Skeleton key={j} className="h-20 w-full rounded-xl" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-label={label}>
      <Skeleton className="h-4 w-24" />
      <div className="surface divide-y overflow-hidden">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 px-4">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 2, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
    </div>
  );
}
