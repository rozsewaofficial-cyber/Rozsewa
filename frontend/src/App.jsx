import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { SocketProvider } from "@/context/SocketContext";

// User Pages
import Index from "./modules/user/pages/Index";
import ShopListing from "./modules/user/pages/ShopListing";
import ShopDetail from "./modules/user/pages/ShopDetail";
import Checkout from "./modules/user/pages/Checkout";
import LiveTracking from "./modules/user/pages/LiveTracking";
import PostService from "./modules/user/pages/PostService";
import Profile from "./modules/user/pages/Profile";
import NotFound from "./modules/user/pages/NotFound";
import BookingWaiting from "./modules/user/pages/BookingWaiting";
import ServiceHistory from "./modules/user/pages/ServiceHistory";
import Wallet from "./modules/user/pages/Wallet";
import Favorites from "./modules/user/pages/Favorites";
import Addresses from "./modules/user/pages/Addresses";
import ReferEarn from "./modules/user/pages/ReferEarn";
import Notifications from "./modules/user/pages/Notifications";
import Security from "./modules/user/pages/Security";
import HelpSupport from "./modules/user/pages/HelpSupport";
import CustomerLogin from "./modules/user/pages/CustomerLogin";
import SubcategoryPage from "./modules/user/pages/SubcategoryPage";
import ComplaintForm from "./modules/user/pages/ComplaintForm";
import SupportTickets from "./modules/user/pages/SupportTickets";
import SubscriptionPlans from "./modules/user/pages/SubscriptionPlans";
import Offers from "./modules/user/pages/Offers";
import ProtectedRoute from "./components/ProtectedRoute";
import GlobalAlarm from "./components/GlobalAlarm";

// Provider Pages
import ProviderDashboard from "./modules/provider/pages/ProviderDashboard";
import ProviderBookings from "./modules/provider/pages/ProviderBookings";
import ProviderStaff from "./modules/provider/pages/ProviderStaff";
import ProviderEarnings from "./modules/provider/pages/ProviderEarnings";
import ProviderLogin from "./modules/provider/pages/ProviderLogin";
import ProviderRegister from "./modules/provider/pages/ProviderRegister";
import ProviderProfile from "./modules/provider/pages/ProviderProfile";
import ProviderServices from "./modules/provider/pages/ProviderServices";
import ProviderAvailability from "./modules/provider/pages/ProviderAvailability";
import ProviderDocuments from "./modules/provider/pages/ProviderDocuments";
import ProviderReviews from "./modules/provider/pages/ProviderReviews";
import Provider99Card from "./modules/provider/pages/Provider99Card";
import ProviderOffers from "./modules/provider/pages/ProviderOffers";
import ProviderSettings from "./modules/provider/pages/ProviderSettings";
import ProviderSupport from "./modules/provider/pages/ProviderSupport";
import ProviderNotifications from "./modules/provider/pages/ProviderNotifications";
import ProviderWallet from "./modules/provider/pages/ProviderWallet";

// Admin Pages
import AdminLogin from "./modules/admin/pages/AdminLogin";
import AdminDashboard from "./modules/admin/pages/AdminDashboard";
import AdminUsers from "./modules/admin/pages/AdminUsers";
import AdminProviders from "./modules/admin/pages/AdminProviders";
import AdminBookings from "./modules/admin/pages/AdminBookings";
import AdminEarnings from "./modules/admin/pages/AdminEarnings";
import AdminCoupons from "./modules/admin/pages/AdminCoupons";
import AdminFeedback from "./modules/admin/pages/AdminFeedback";
import AdminServices from "./modules/admin/pages/AdminServices";
import AdminSettings from "./modules/admin/pages/AdminSettings";
import AdminDisputes from "./modules/admin/pages/AdminDisputes";
import AdminBanners from "./modules/admin/pages/AdminBanners";
import AdminNotifications from "./modules/admin/pages/AdminNotifications";
import AdminActivityLog from "./modules/admin/pages/AdminActivityLog";
import AdminKYC from "./modules/admin/pages/AdminKYC";
import Admin99Card from "./modules/admin/pages/Admin99Card";
import AdminCommission from "./modules/admin/pages/AdminCommission";
import AdminOffers from "./modules/admin/pages/AdminOffers";
import AdminZones from "./modules/admin/pages/AdminZones";
import AdminDispatch from "./modules/admin/pages/AdminDispatch";
import AdminEmergency from "./modules/admin/pages/AdminEmergency";
import AdminFinance from "./modules/admin/pages/AdminFinance";
import AdminQuality from "./modules/admin/pages/AdminQuality";
import AdminSystem from "./modules/admin/pages/AdminSystem";
import AdminPromotions from "./modules/admin/pages/AdminPromotions";
import AdminHelpTraining from "./modules/admin/pages/AdminHelpTraining";
import AdminHRM from "./modules/admin/pages/AdminHRM";


// Admin Layout
import AdminLayout from "./modules/admin/components/AdminLayout";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <ChatProvider>
          <SocketProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <Toaster />
                <Sonner position="bottom-right" expand={true} richColors />
                <GlobalAlarm />
                <AnimatePresence mode="wait">
                  <Routes>
                    {/* Customer Login */}
                    <Route path="/" element={<Navigate to="/provider/login" replace />} />
                    <Route path="/home" element={<Index />} />
                    <Route path="/shops" element={<ShopListing />} />
                    <Route path="/shop/:id" element={<ShopDetail />} />
                    <Route path="/category" element={<SubcategoryPage />} />

                    {/* Protected Customer Routes */}
                    <Route path="/checkout" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Checkout /></ProtectedRoute>} />
                    <Route path="/tracking" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><LiveTracking /></ProtectedRoute>} />
                    <Route path="/booking-waiting" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><BookingWaiting /></ProtectedRoute>} />
                    <Route path="/my-bookings" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><ServiceHistory /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Profile /></ProtectedRoute>} />
                    <Route path="/wallet" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Wallet /></ProtectedRoute>} />
                    <Route path="/favorites" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Favorites /></ProtectedRoute>} />
                    <Route path="/addresses" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Addresses /></ProtectedRoute>} />
                    <Route path="/security" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Security /></ProtectedRoute>} />
                    <Route path="/subscriptions" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><SubscriptionPlans /></ProtectedRoute>} />

                    {/* Public Info Routes */}
                    <Route path="/post-service" element={<PostService />} />
                    <Route path="/refer-earn" element={<ReferEarn />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/help-support" element={<HelpSupport />} />
                    <Route path="/complaint" element={<ComplaintForm />} />
                    <Route path="/support-tickets" element={<SupportTickets />} />
                    <Route path="/offers" element={<Offers />} />

                    {/* Provider Routes */}
                    <Route path="/provider" element={<ProtectedRoute allowedRoles={["provider"]}><ProviderDashboard /></ProtectedRoute>} />
                    <Route path="/provider/login" element={<ProviderLogin />} />
                    <Route path="/provider/register" element={<ProviderRegister />} />
                    <Route path="/provider/profile" element={<ProviderProfile />} />
                    <Route path="/provider/bookings" element={<ProviderBookings />} />
                    <Route path="/provider/staff" element={<ProviderStaff />} />
                    <Route path="/provider/earnings" element={<ProviderEarnings />} />
                    <Route path="/provider/services" element={<ProviderServices />} />
                    <Route path="/provider/availability" element={<ProviderAvailability />} />
                    <Route path="/provider/documents" element={<ProviderDocuments />} />
                    <Route path="/provider/reviews" element={<ProviderReviews />} />
                    <Route path="/provider/99card" element={<Provider99Card />} />
                    <Route path="/provider/offers" element={<ProviderOffers />} />
                    <Route path="/provider/settings" element={<ProviderSettings />} />
                    <Route path="/provider/support" element={<ProviderSupport />} />
                    <Route path="/provider/notifications" element={<ProviderNotifications />} />
                    <Route path="/provider/wallet" element={<ProviderWallet />} />

                    {/* Admin Routes with Persistent Layout */}
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="hrm" element={<AdminHRM />} />
                      <Route path="providers" element={<AdminProviders />} />
                      <Route path="bookings" element={<AdminBookings />} />
                      <Route path="earnings" element={<AdminEarnings />} />
                      <Route path="coupons" element={<AdminCoupons />} />
                      <Route path="feedback" element={<AdminFeedback />} />
                      <Route path="services" element={<AdminServices />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="disputes" element={<AdminDisputes />} />
                      <Route path="banners" element={<AdminBanners />} />
                      <Route path="notifications" element={<AdminNotifications />} />
                      <Route path="activity-log" element={<AdminActivityLog />} />
                      <Route path="kyc" element={<AdminKYC />} />
                      <Route path="99cards" element={<Admin99Card />} />
                      <Route path="commission" element={<AdminCommission />} />
                      <Route path="offers" element={<AdminOffers />} />
                      <Route path="zones" element={<AdminZones />} />
                      <Route path="dispatch" element={<AdminDispatch />} />
                      <Route path="emergency" element={<AdminEmergency />} />
                      <Route path="finance" element={<AdminFinance />} />
                      <Route path="quality" element={<AdminQuality />} />
                      <Route path="master-data" element={<AdminSystem />} />
                      <Route path="promotions" element={<AdminPromotions />} />

                      <Route path="help-training" element={<AdminHelpTraining />} />
                    </Route>

                    <Route path="/admin/login" element={<AdminLogin />} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AnimatePresence>
              </TooltipProvider>
            </QueryClientProvider>
          </SocketProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
