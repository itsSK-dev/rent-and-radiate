import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { primaryRole } from "@/lib/authRouting";
import { Flower2, Search, ShoppingBag, ShoppingCart, Store, User as UserIcon, LogOut, Menu, Package, Heart, Bell, Truck } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { LocationSelector } from "@/components/LocationSelector";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNewOrderCount } from "@/hooks/useNewOrderCount";
import { UniversalSearchDialog } from "@/components/UniversalSearchDialog";

export function Navbar() {
  const { user, roles, deliveryApplication, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const role = primaryRole(roles, deliveryApplication);
  const isVendor = role === "store_owner";
  const isPartner = role === "delivery_partner";
  // Customers (and admins, who need full visibility) see shopping features.
  const showShopping = !user || role === "customer" || role === "admin";
  const newOrderCount = useNewOrderCount();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3 md:gap-5 min-w-0 flex-1">
          <Link to="/" className="flex items-center gap-2 group shrink-0 min-w-0">
            <Flower2 className="h-6 w-6 text-primary group-hover:rotate-12 transition-smooth shrink-0" strokeWidth={1.5} />
            <span className="font-display text-lg sm:text-xl md:text-2xl tracking-tight truncate">
              <span className="hidden xs:inline">Rent &amp; Radiate</span>
              <span className="xs:hidden">R&amp;R</span>
            </span>
          </Link>
          <div className="hidden sm:block">
            <LocationSelector />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          {showShopping && (
            <>
              <NavItem to="/browse?category=dress">Dresses</NavItem>
              <NavItem to="/browse?category=jewellery">Jewellery</NavItem>
              <NavItem to="/browse">All Stores</NavItem>
            </>
          )}
          {isVendor && (
            <>
              <NavItem to="/vendor">Dashboard</NavItem>
              <NavItem to="/vendor/orders">Orders</NavItem>
            </>
          )}
          {isPartner && (
            <>
              <NavItem to="/delivery">Deliveries</NavItem>
              <NavItem to="/delivery/register">Application</NavItem>
            </>
          )}
          <NavItem to="/how-it-works">How it works</NavItem>
          {showShopping && <NavItem to="/advertise">Advertise</NavItem>}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {showShopping && (
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          )}
          {user ? <NotificationBell /> : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          )}
          {showShopping && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/wishlist" : "/auth")} aria-label="Wishlist">
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/cart" : "/auth")} aria-label="Cart">
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </>
          )}
          {user ? (
            <>
              {showShopping && (
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
                  <Button variant="soft" size="sm" onClick={() => navigate("/become-vendor")}>
                    <Store className="h-4 w-4 mr-2" /> Open a store
                  </Button>
                </>
              )}
              {isVendor && (
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
              )}
              {isPartner && (
                <Button variant="soft" size="sm" onClick={() => navigate("/delivery")}>
                  <Truck className="h-4 w-4 mr-2" /> Delivery
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/role-select")}>
                <UserIcon className="h-4 w-4 mr-2" /> Sign in
              </Button>
              <Button variant="hero" size="sm" onClick={() => navigate("/role-select")}>
                Get started
              </Button>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-0 shrink-0">
          {showShopping && (
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Search" className="h-11 w-11">
              <Search className="h-[18px] w-[18px]" />
            </Button>
          )}
          {user ? <NotificationBell /> : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} aria-label="Notifications" className="h-11 w-11">
              <Bell className="h-[18px] w-[18px]" />
            </Button>
          )}
          {showShopping && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/wishlist" : "/auth")} aria-label="Wishlist" className="h-11 w-11">
                <Heart className="h-[18px] w-[18px]" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/cart" : "/auth")} aria-label="Cart" className="h-11 w-11">
                <ShoppingCart className="h-[18px] w-[18px]" />
              </Button>
            </>
          )}
          <button className="h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-muted" onClick={() => setOpen(!open)} aria-label="Menu">
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
            {showShopping && (
              <>
                <Link to="/browse?category=dress" onClick={() => setOpen(false)} className="py-2">Dresses</Link>
                <Link to="/browse?category=jewellery" onClick={() => setOpen(false)} className="py-2">Jewellery</Link>
                <Link to="/browse" onClick={() => setOpen(false)} className="py-2">All Stores</Link>
                <Link to="/advertise" onClick={() => setOpen(false)} className="py-2">Advertise</Link>
              </>
            )}
            <Link to="/how-it-works" onClick={() => setOpen(false)} className="py-2">How it works</Link>
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <Link to="/profile" onClick={() => setOpen(false)} className="py-2">Profile</Link>
                <Link to="/notifications" onClick={() => setOpen(false)} className="py-2">Notifications</Link>
                {showShopping && (
                  <>
                    <Link to="/cart" onClick={() => setOpen(false)} className="py-2">Cart</Link>
                    <Link to="/wishlist" onClick={() => setOpen(false)} className="py-2">Wishlist</Link>
                    <Link to="/my-rentals" onClick={() => setOpen(false)} className="py-2">My orders</Link>
                    <Link to="/my-payments" onClick={() => setOpen(false)} className="py-2">My payments</Link>
                    <Link to="/rewards" onClick={() => setOpen(false)} className="py-2">Rewards</Link>
                    <Link to="/refer" onClick={() => setOpen(false)} className="py-2">Refer a friend</Link>
                    <Link to="/become-vendor" onClick={() => setOpen(false)} className="py-2">Open a store</Link>
                  </>
                )}
                {isVendor && (
                  <>
                    <Link to="/vendor" onClick={() => setOpen(false)} className="py-2">Vendor dashboard</Link>
                    <Link to="/vendor/orders" onClick={() => setOpen(false)} className="py-2 flex items-center gap-2">
                      Vendor orders
                      {newOrderCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                          {newOrderCount > 99 ? "99+" : newOrderCount}
                        </span>
                      )}
                    </Link>
                    <Link to="/vendor/verification" onClick={() => setOpen(false)} className="py-2">Shop verification</Link>
                  </>
                )}
                {isPartner && (
                  <>
                    <Link to="/delivery" onClick={() => setOpen(false)} className="py-2">Delivery dashboard</Link>
                    <Link to="/delivery/register" onClick={() => setOpen(false)} className="py-2">Application status</Link>
                  </>
                )}
                <Link to="/settings" onClick={() => setOpen(false)} className="py-2">Settings</Link>
                <Link to="/settings/notifications" onClick={() => setOpen(false)} className="py-2">Notification settings</Link>
                <button onClick={() => { signOut(); setOpen(false); }} className="py-2 text-left">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/role-select" onClick={() => setOpen(false)} className="py-2">Sign in</Link>
                <Link to="/role-select" onClick={() => setOpen(false)} className="py-2 text-primary font-medium">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
      <UniversalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
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
