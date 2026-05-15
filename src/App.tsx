import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";
import MyRentals from "./pages/MyRentals";
import BecomeVendor from "./pages/BecomeVendor";
import Vendor from "./pages/Vendor";
import HowItWorks from "./pages/HowItWorks";
import Admin from "./pages/Admin";
import AdminEmailPreview from "./pages/AdminEmailPreview";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import Receipt from "./pages/Receipt";
import Cart from "./pages/Cart";
import TrackOrder from "./pages/TrackOrder";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/my-rentals" element={<MyRentals />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout/:rentalId" element={<Checkout />} />
            <Route path="/receipt/:rentalId" element={<Receipt />} />
            <Route path="/track/:rentalId" element={<TrackOrder />} />
            <Route path="/become-vendor" element={<BecomeVendor />} />
            <Route path="/vendor" element={<Vendor />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/email-previews" element={<AdminEmailPreview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
