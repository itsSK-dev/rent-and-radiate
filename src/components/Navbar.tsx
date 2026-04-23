import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Flower2, ShoppingBag, Store, User as UserIcon, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isVendor = roles.includes("store_owner");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <Flower2 className="h-6 w-6 text-primary group-hover:rotate-12 transition-smooth" strokeWidth={1.5} />
          <span className="font-display text-2xl tracking-tight">Bloom</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <NavItem to="/browse?category=dress">Dresses</NavItem>
          <NavItem to="/browse?category=jewellery">Jewellery</NavItem>
          <NavItem to="/browse">All Stores</NavItem>
          <NavItem to="/how-it-works">How it works</NavItem>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/my-rentals")}>
                <ShoppingBag className="h-4 w-4 mr-2" /> My rentals
              </Button>
              {isVendor ? (
                <Button variant="soft" size="sm" onClick={() => navigate("/vendor")}>
                  <Store className="h-4 w-4 mr-2" /> Vendor
                </Button>
              ) : (
                <Button variant="soft" size="sm" onClick={() => navigate("/become-vendor")}>
                  <Store className="h-4 w-4 mr-2" /> Open a store
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                <UserIcon className="h-4 w-4 mr-2" /> Sign in
              </Button>
              <Button variant="hero" size="sm" onClick={() => navigate("/auth?mode=signup")}>
                Get started
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="container flex flex-col py-4 gap-2 text-sm">
            <Link to="/browse?category=dress" onClick={() => setOpen(false)} className="py-2">Dresses</Link>
            <Link to="/browse?category=jewellery" onClick={() => setOpen(false)} className="py-2">Jewellery</Link>
            <Link to="/browse" onClick={() => setOpen(false)} className="py-2">All Stores</Link>
            <Link to="/how-it-works" onClick={() => setOpen(false)} className="py-2">How it works</Link>
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <Link to="/my-rentals" onClick={() => setOpen(false)} className="py-2">My rentals</Link>
                <Link to={isVendor ? "/vendor" : "/become-vendor"} onClick={() => setOpen(false)} className="py-2">
                  {isVendor ? "Vendor dashboard" : "Open a store"}
                </Link>
                <button onClick={() => { signOut(); setOpen(false); }} className="py-2 text-left">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/auth" onClick={() => setOpen(false)} className="py-2">Sign in</Link>
                <Link to="/auth?mode=signup" onClick={() => setOpen(false)} className="py-2 text-primary font-medium">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "transition-smooth hover:text-primary",
          isActive ? "text-primary" : "text-foreground/70"
        )
      }
    >
      {children}
    </NavLink>
  );
}
