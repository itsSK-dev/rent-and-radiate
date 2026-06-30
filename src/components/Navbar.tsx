import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Flower2, Search, ShoppingBag, ShoppingCart, Store, User as UserIcon, LogOut, Menu, Package, Heart, Bell } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { LocationSelector } from "@/components/LocationSelector";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNewOrderCount } from "@/hooks/useNewOrderCount";

export function Navbar() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isVendor = roles.includes("store_owner");
  const newOrderCount = useNewOrderCount();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <Flower2 className="h-6 w-6 text-primary group-hover:rotate-12 transition-smooth" strokeWidth={1.5} />
            <span className="font-display text-xl md:text-2xl tracking-tight">Rent &amp; Radiate</span>
          </Link>
          <div className="hidden sm:block">
            <LocationSelector />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <NavItem to="/browse?category=dress">Dresses</NavItem>
          <NavItem to="/browse?category=jewellery">Jewellery</NavItem>
          <NavItem to="/browse">All Stores</NavItem>
          <NavItem to="/how-it-works">How it works</NavItem>
          <NavItem to="/advertise">Advertise</NavItem>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")} aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          {user ? <NotificationBell /> : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/wishlist" : "/auth")} aria-label="Wishlist">
            <Heart className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/cart" : "/auth")} aria-label="Cart">
            <ShoppingCart className="h-4 w-4" />
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/my-rentals")}>
                <ShoppingBag className="h-4 w-4 mr-2" /> My orders
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/my-payments")}>
                My payments
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/rewards")}>
                Rewards
              </Button>
              {isVendor ? (
                <>
                  <Button variant="ghost" size="sm" className="relative" onClick={() => navigate("/vendor/orders")}>
                    <Package className="h-4 w-4 mr-2" /> Orders
                    {newOrderCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {newOrderCount > 99 ? "99+" : newOrderCount}
                      </span>
                    )}
                  </Button>
                  <Button variant="soft" size="sm" onClick={() => navigate("/vendor")}>
                    <Store className="h-4 w-4 mr-2" /> Vendor
                  </Button>
                </>
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

        <div className="flex md:hidden items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")} aria-label="Search" className="h-9 w-9">
            <Search className="h-4 w-4" />
          </Button>
          {user ? <NotificationBell /> : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} aria-label="Notifications" className="h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/wishlist" : "/auth")} aria-label="Wishlist" className="h-9 w-9">
            <Heart className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/cart" : "/auth")} aria-label="Cart" className="h-9 w-9">
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <button className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted" onClick={() => setOpen(!open)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="container flex flex-col py-4 gap-2 text-sm">
            <div className="pb-2 sm:hidden">
              <LocationSelector />
            </div>
            <Link to="/browse?category=dress" onClick={() => setOpen(false)} className="py-2">Dresses</Link>
            <Link to="/browse?category=jewellery" onClick={() => setOpen(false)} className="py-2">Jewellery</Link>
            <Link to="/browse" onClick={() => setOpen(false)} className="py-2">All Stores</Link>
            <Link to="/how-it-works" onClick={() => setOpen(false)} className="py-2">How it works</Link>
            <Link to="/advertise" onClick={() => setOpen(false)} className="py-2">Advertise</Link>
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <Link to="/cart" onClick={() => setOpen(false)} className="py-2">Cart</Link>
                <Link to="/wishlist" onClick={() => setOpen(false)} className="py-2">Wishlist</Link>
                <Link to="/notifications" onClick={() => setOpen(false)} className="py-2">Notifications</Link>
                <Link to="/my-rentals" onClick={() => setOpen(false)} className="py-2">My orders</Link>
                <Link to="/my-payments" onClick={() => setOpen(false)} className="py-2">My payments</Link>
                <Link to="/rewards" onClick={() => setOpen(false)} className="py-2">Rewards</Link>
                <Link to="/settings/notifications" onClick={() => setOpen(false)} className="py-2">Notification settings</Link>
                <Link to={isVendor ? "/vendor" : "/become-vendor"} onClick={() => setOpen(false)} className="py-2">
                  {isVendor ? "Vendor dashboard" : "Open a store"}
                </Link>
                {isVendor && (
                  <Link to="/vendor/orders" onClick={() => setOpen(false)} className="py-2 flex items-center gap-2">
                    Vendor orders
                    {newOrderCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {newOrderCount > 99 ? "99+" : newOrderCount}
                      </span>
                    )}
                  </Link>
                )}
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
