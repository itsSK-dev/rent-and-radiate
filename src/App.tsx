import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WishlistProvider } from "@/hooks/useWishlist";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider } from "./hooks/useTheme";

// Home is eager for fastest FCP/LCP on the landing route; everything else is code-split.
import Index from "./pages/Index";

const Browse = lazy(() => import("./pages/Browse"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const MyRentals = lazy(() => import("./pages/MyRentals"));
const BecomeVendor = lazy(() => import("./pages/BecomeVendor"));
const Vendor = lazy(() => import("./pages/Vendor"));
const VendorOrders = lazy(() => import("./pages/VendorOrders"));
const VendorVerification = lazy(() => import("./pages/VendorVerification"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminEmailPreview = lazy(() => import("./pages/AdminEmailPreview"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Cart = lazy(() => import("./pages/Cart"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const MyPayments = lazy(() => import("./pages/MyPayments"));
const SupportChat = lazy(() =>
  import("./components/SupportChat").then((m) => ({ default: m.SupportChat }))
);
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Advertise = lazy(() => import("./pages/Advertise"));
const AdvertiseBook = lazy(() => import("./pages/AdvertiseBook"));
const MyAdvertisements = lazy(() => import("./pages/MyAdvertisements"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Refer = lazy(() => import("./pages/Refer"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Help = lazy(() => import("./pages/Help"));
const Settings = lazy(() => import("./pages/Settings"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const RoleSelect = lazy(() => import("./pages/RoleSelect"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading page"
    className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground"
  >
    Loading…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WishlistProvider>
              <ScrollToTop />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/my-rentals" element={<MyRentals />} />
                  <Route path="/my-payments" element={<MyPayments />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/checkout/:rentalId" element={<Checkout />} />
                  <Route path="/receipt/:rentalId" element={<Receipt />} />
                  <Route path="/payment/success/:rentalId" element={<PaymentResult kind="success" />} />
                  <Route path="/payment/failure/:rentalId" element={<PaymentResult kind="failure" />} />
                  <Route path="/payment/failure" element={<PaymentResult kind="failure" />} />
                  <Route path="/track/:rentalId" element={<TrackOrder />} />
                  <Route path="/become-vendor" element={<BecomeVendor />} />
                  <Route path="/vendor" element={<Vendor />} />
                  <Route path="/vendor/orders" element={<VendorOrders />} />
                  <Route path="/vendor/verification" element={<VendorVerification />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/email-previews" element={<AdminEmailPreview />} />
                  <Route path="/advertise" element={<Advertise />} />
                  <Route path="/advertise/book" element={<AdvertiseBook />} />
                  <Route path="/my-advertisements" element={<MyAdvertisements />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings/notifications" element={<NotificationSettings />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/rewards" element={<Rewards />} />
                  <Route path="/refer" element={<Refer />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <SupportChat />
              </Suspense>
            </WishlistProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
