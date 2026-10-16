import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ShoppingBasket, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if (location.pathname !== "/welcome") {
      const { data: p } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).maybeSingle();
      if (!p?.onboarded) throw redirect({ to: "/welcome" });
    }
  },
  component: Layout,
});

const NAV = [
  { to: "/plan", label: "Plan", icon: CalendarDays },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/import", label: "Add with AI", icon: Sparkles },
  { to: "/grocery", label: "Groceries", icon: ShoppingBasket },
] as const;

function Layout() {
  const { pathname } = useLocation();
  const bare = pathname === "/welcome" || pathname === "/print" || pathname === "/grocery-print";
  return (
    <div className="min-h-screen pb-24">
      {!bare && (
        <header className="print-hide mx-auto flex max-w-3xl items-center justify-between px-5 pt-5">
          <Link to="/plan" className="font-display text-2xl text-primary">Meal Planner</Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
            aria-label="Sign out"
          >
            <LogOut className="size-5" />
          </button>
        </header>
      )}
      <Outlet />
      {!bare && (
        <nav className="print-hide fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <ul className="mx-auto grid max-w-3xl grid-cols-4">
            {NAV.map(({ to, label, icon: Icon }) => {
              const on = pathname.startsWith(to) || (to === "/plan" && pathname === "/checkin");
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${on ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <Icon className="size-5" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
