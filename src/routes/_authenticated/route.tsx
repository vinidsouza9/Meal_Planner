import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, History, LogOut, Menu, Sparkles, ShoppingBasket, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { profileQuery } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  { to: "/recipes", label: "Recipes", icon: BookOpen },
  { to: "/checkin", label: "Plan my week", icon: Sparkles },
  { to: "/plan", label: "This week's plan", icon: CalendarDays },
  { to: "/history", label: "History", icon: History },
  { to: "/grocery", label: "Groceries", icon: ShoppingBasket },
] as const;

function UserMenu({ email, firstName, avatar }: { email: string; firstName: string; avatar?: string | null }) {
  const navigate = useNavigate();
  const initial = (firstName[0] || email[0] || "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost"
          className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          {avatar ? <img src={avatar} alt="Profile photo" className="size-8 rounded-full object-cover" /> : <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initial}</span>}
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{firstName || initial}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{firstName || initial}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account"><UserRound /> Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Layout() {
  const { pathname } = useLocation();
  const bare = pathname === "/welcome" || pathname === "/print" || pathname === "/grocery-print";
  const { data: profile } = useQuery(profileQuery);
  const [menuOpen, setMenuOpen] = useState(false);


  const isOn = (to: string) => pathname.startsWith(to);

  return (
    <div className="min-h-screen">
      {!bare && (
        <header className="print-hide sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
            <Link to="/plan" className="font-display text-2xl text-primary">Meal Planner</Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {NAV.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isOn(to) ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-current={isOn(to) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <UserMenu email={profile?.email ?? ""} firstName={profile?.first_name ?? ""} avatar={profile?.avatarSrc ?? null} />
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button className="grid size-11 place-items-center rounded-xl text-foreground hover:bg-muted md:hidden" aria-label="Open menu">
                    <Menu className="size-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="font-display text-left text-xl text-primary">Meal Planner</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-4 grid gap-1" aria-label="Main">
                    {NAV.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setMenuOpen(false)}
                        className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                          isOn(to) ? "bg-accent text-primary" : "text-foreground hover:bg-muted"
                        }`}
                        aria-current={isOn(to) ? "page" : undefined}
                      >
                        <Icon className="size-5" />
                        {label}
                      </Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
      )}
      {!bare && profile && (!profile.first_name || !profile.last_name) && <div className="mx-auto max-w-6xl px-5 py-3 text-sm"><Link to="/account" className="text-primary underline">Add your name to personalize your account.</Link></div>}
      <Outlet />
    </div>
  );
}
