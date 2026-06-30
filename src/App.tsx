import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { WishlistProvider } from "@/hooks/useWishlist";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";
import MyRentals from "./pages/MyRentals";
import BecomeVendor from "./pages/BecomeVendor";
import Vendor from "./pages/Vendor";
import VendorOrders from "./pages/VendorOrders";
import VendorVerification from "./pages/VendorVerification";

import HowItWorks from "./pages/HowItWorks";
import Admin from "./pages/Admin";
import AdminEmailPreview from "./pages/AdminEmailPreview";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import Receipt from "./pages/Receipt";
import Cart from "./pages/Cart";
import TrackOrder from "./pages/TrackOrder";
import PaymentResult from "./pages/PaymentResult";
import MyPayments from "./pages/MyPayments";
import ScrollToTop from "./components/ScrollToTop";
import { SupportChat } from "./components/SupportChat";
import Unsubscribe from "./pages/Unsubscribe";
import Advertise from "./pages/Advertise";
import AdvertiseBook from "./pages/AdvertiseBook";
import MyAdvertisements from "./pages/MyAdvertisements";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import Rewards from "./pages/Rewards";
import Wishlist from "./pages/Wishlist";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Help from "./pages/Help";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WishlistProvider>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/rewards" element={<Rewards />} />
             <Route path="/about" element={<About />} />
             <Route path="/contact" element={<Contact />} />
             <Route path="/privacy" element={<Privacy />} />
             <Route path="/terms" element={<Terms />} />
             <Route path="/help" element={<Help />} />
             <Route path="*" element={<NotFound />} />
            </Routes>
            <SupportChat />
          </WishlistProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
