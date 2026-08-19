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
import { ConfirmDialogProvider } from "@/hooks/useConfirm";

// User Pages
import Index from "./modules/user/pages/Index";
import ShopListing from "./modules/user/pages/ShopListing";
import ShopDetail from "./modules/user/pages/ShopDetail";
import SewakServices from "./modules/user/pages/SewakServices";
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
import Scrap from "./modules/user/pages/Scrap";
import AddScrap from "./modules/user/pages/Scrap/AddScrap";
import RojsewaBazaar from "./modules/user/pages/RojsewaBazaar";
import BazaarAdDetails from "./modules/user/pages/BazaarAdDetails";
import BazaarOfferChat from "./modules/user/pages/BazaarOfferChat";
import LeadRequirementForm from "./modules/user/pages/LeadRequirementForm";
import MyLeads from "./modules/user/pages/MyLeads";
import MyBazaarAds from "./modules/user/pages/MyBazaarAds";

import HelpSupport from "./modules/user/pages/HelpSupport";
import CustomerLogin from "./modules/user/pages/CustomerLogin";
import SubcategoryPage from "./modules/user/pages/SubcategoryPage";
import ComplaintForm from "./modules/user/pages/ComplaintForm";
import SupportTickets from "./modules/user/pages/SupportTickets";
import SubscriptionPlans from "./modules/user/pages/SubscriptionPlans";
import Offers from "./modules/user/pages/Offers";
import Terms from "./modules/user/pages/Terms";
import Privacy from "./modules/user/pages/Privacy";
import ProtectedRoute from "./components/ProtectedRoute";
import GlobalAlarm from "./components/GlobalAlarm";
import LocationGate from "./components/LocationGate";
import ScrollToTop from "./components/ScrollToTop";

// Provider Pages
import ProviderDashboard from "./modules/provider/pages/ProviderDashboard";
import ProviderLeads from "./modules/provider/pages/ProviderLeads";
import ProviderBookings from "./modules/provider/pages/ProviderBookings";
import ProviderStaff from "./modules/provider/pages/ProviderStaff";
import ProviderEarnings from "./modules/provider/pages/ProviderEarnings";
import ProviderLogin from "./modules/provider/pages/ProviderLogin";
import ProviderRegister from "./modules/provider/pages/ProviderRegister";
import SewakRegister from "./modules/provider/pages/SewakRegister";
import ProviderForgotPassword from "./modules/provider/pages/ProviderForgotPassword";
import DigilockerCallback from "./modules/provider/pages/DigilockerCallback";
import ProviderProfile from "./modules/provider/pages/ProviderProfile";
import ProviderServices from "./modules/provider/pages/ProviderServices";
import ProviderSkillSessions from "./modules/provider/pages/ProviderSkillSessions";
import SewakKitStore from "./modules/provider/pages/SewakKitStore";
import ProviderAvailability from "./modules/provider/pages/ProviderAvailability";
import ProviderDocuments from "./modules/provider/pages/ProviderDocuments";
import ProviderReviews from "./modules/provider/pages/ProviderReviews";
import Provider99Card from "./modules/provider/pages/Provider99Card";
import ProviderBenefitPolicy from "./modules/provider/pages/ProviderBenefitPolicy";
import ProviderSettings from "./modules/provider/pages/ProviderSettings";
import ProviderSupport from "./modules/provider/pages/ProviderSupport";
import ProviderNotifications from "./modules/provider/pages/ProviderNotifications";
import ProviderWallet from "./modules/provider/pages/ProviderWallet";
import ProviderSubscriptions from "./modules/provider/pages/ProviderSubscriptions";
import ProviderBannerPromotion from "./modules/provider/pages/ProviderBannerPromotion";

// Admin Pages
import AdminLogin from "./modules/admin/pages/AdminLogin";
import AdminDashboard from "./modules/admin/pages/AdminDashboard";
import AdminUsers from "./modules/admin/pages/AdminUsers";
import AdminProviders from "./modules/admin/pages/AdminProviders";
import AdminBookings from "./modules/admin/pages/AdminBookings";
import AdminEarnings from "./modules/admin/pages/AdminEarnings";
import AdminCoupons from "./modules/admin/pages/AdminCoupons";
import AdminFeedback from "./modules/admin/pages/AdminFeedback";
import AdminSupport from "./modules/admin/pages/AdminSupport";
import AdminServices from "./modules/admin/pages/AdminServices";
import AdminLeads from "./modules/admin/pages/AdminLeads";
import AdminLeadForms from "./modules/admin/pages/AdminLeadForms";
import SewakPricing from "./modules/admin/pages/SewakPricing";
import AdminSettings from "./modules/admin/pages/AdminSettings";
import AdminCashLimits from "./modules/admin/pages/AdminCashLimits";
import PartnerProgramConfig from "./modules/admin/pages/PartnerProgramConfig";
import AdminCommissionAnalytics from "./modules/admin/pages/AdminCommissionAnalytics";
import AdminDisputes from "./modules/admin/pages/AdminDisputes";
import AdminBanners from "./modules/admin/pages/AdminBanners";
import AdminProviderBanners from "./modules/admin/pages/AdminProviderBanners";
import AdminNotifications from "./modules/admin/pages/AdminNotifications";
import AdminActivityLog from "./modules/admin/pages/AdminActivityLog";
import AdminProviderSubscriptions from "./modules/admin/pages/AdminProviderSubscriptions";
import AdminSubscriptions from "./modules/admin/pages/AdminSubscriptions";
import AdminKYC from "./modules/admin/pages/AdminKYC";
import Admin99Card from "./modules/admin/pages/Admin99Card";
import AdminCommission from "./modules/admin/pages/AdminCommission";
import AdminWithdrawals from "./modules/admin/pages/AdminWithdrawals";
import AdminScrap from "./modules/admin/pages/AdminScrap";
import AdminBazaar from "./modules/admin/pages/AdminBazaar";

import AdminZones from "./modules/admin/pages/AdminZones";
import AdminTrainingCenters from "./modules/admin/pages/AdminTrainingCenters";
import AdminTrainers from "./modules/admin/pages/AdminTrainers";
import AdminSkillSessions from "./modules/admin/pages/AdminSkillSessions";
import AdminStarterKits from "./modules/admin/pages/AdminStarterKits";
import AdminKitCombos from "./modules/admin/pages/AdminKitCombos";
import AdminKitPaymentSettings from "./modules/admin/pages/AdminKitPaymentSettings";
import AdminKitOrders from "./modules/admin/pages/AdminKitOrders";
import TrainerLogin from "./modules/trainer/pages/TrainerLogin";
import TrainerSessions from "./modules/trainer/pages/TrainerSessions";
import TrainerProtectedRoute from "./modules/trainer/components/TrainerProtectedRoute";
import AdminDispatch from "./modules/admin/pages/AdminDispatch";
import AdminEmergency from "./modules/admin/pages/AdminEmergency";
import AdminFinance from "./modules/admin/pages/AdminFinance";
import ProviderReports from "./modules/admin/pages/ProviderReports";
import AdminReports from "./modules/admin/pages/AdminReports";


import AdminHelpTraining from "./modules/admin/pages/AdminHelpTraining";
import AdminHRM from "./modules/admin/pages/AdminHRM";
import AdminSuper from "./modules/admin/pages/AdminSuper";
import SewakManagement from "./modules/admin/pages/SewakManagement";
import AdminVerifySewak from "./modules/admin/pages/AdminVerifySewak";
import AdminSewakEnquiries from "./modules/admin/pages/AdminSewakEnquiries";
import AdminVerifyEmployee from "./modules/admin/pages/AdminVerifyEmployee";
import AdminVerifyCombo from "./modules/admin/pages/AdminVerifyCombo";
import AdminBenefitPolicies from "./modules/admin/pages/AdminBenefitPolicies";
import AdminAuditLogs from "./modules/admin/pages/AdminAuditLogs";
import AdminNightCharge from "./modules/admin/pages/AdminNightCharge";
import AdminSewakIncentives from "./modules/admin/pages/AdminSewakIncentives";
import DistanceCharges from "./modules/admin/pages/DistanceCharges";
import AdminServiceRadius from "./modules/admin/pages/AdminServiceRadius";
import AdminUnauthorizedPayments from "./modules/admin/pages/AdminUnauthorizedPayments";
import AdminFeeSettings from "./modules/admin/pages/AdminFeeSettings";

// Admin Layout
import AdminLayout from "./modules/admin/components/AdminLayout";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <ScrollToTop />
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <ChatProvider>
          <SocketProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <ConfirmDialogProvider>
                  <Toaster />
                  <Sonner position="bottom-right" expand={true} richColors />
                  <GlobalAlarm />
                  <AnimatePresence mode="wait">
                    <Routes>
                      {/* User Panel as Default */}
                      <Route path="/" element={<Navigate to="/home" replace />} />
                      <Route path="/login" element={<CustomerLogin />} />

                      {/* Location Gated Customer Routes */}
                      <Route element={<LocationGate />}>
                        <Route path="/home" element={<Index />} />
                        <Route path="/shops" element={<ShopListing />} />
                        <Route path="/shop/:id" element={<ShopDetail />} />
                        <Route path="/sewak-services" element={<SewakServices />} />
                        <Route path="/category" element={<SubcategoryPage />} />
                        <Route path="/subcategory" element={<SubcategoryPage />} />

                        {/* Protected Customer Routes */}
                        <Route path="/checkout" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><Checkout /></ProtectedRoute>} />
                        <Route path="/tracking" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><LiveTracking /></ProtectedRoute>} />
                        <Route path="/booking-waiting" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><BookingWaiting /></ProtectedRoute>} />
                        <Route path="/my-bookings" element={<ProtectedRoute allowedRoles={["customer", "provider"]}><ServiceHistory /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Profile /></ProtectedRoute>} />
                        <Route path="/favorites" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Favorites /></ProtectedRoute>} />
                        <Route path="/addresses" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Addresses /></ProtectedRoute>} />
                        <Route path="/notifications" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Notifications /></ProtectedRoute>} />
                        <Route path="/wallet" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Wallet /></ProtectedRoute>} />
                        <Route path="/submit-lead" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><LeadRequirementForm /></ProtectedRoute>} />
                        <Route path="/my-leads" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><MyLeads /></ProtectedRoute>} />
                        <Route path="/scrap" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><Scrap /></ProtectedRoute>} />
                        <Route path="/scrap/add" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><AddScrap /></ProtectedRoute>} />
                        <Route path="/bazaar" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><RojsewaBazaar /></ProtectedRoute>} />
                        <Route path="/my-bazaar-ads" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><MyBazaarAds /></ProtectedRoute>} />
                        <Route path="/bazaar/:id" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><BazaarAdDetails /></ProtectedRoute>} />
                        <Route path="/bazaar/:id/offer" element={<ProtectedRoute allowedRoles={["customer", "provider", "sewak"]}><BazaarOfferChat /></ProtectedRoute>} />

                        {/* Public Info Routes */}
                        <Route path="/post-service" element={<PostService />} />
                        <Route path="/complaint" element={<ComplaintForm />} />
                        <Route path="/support-tickets" element={<SupportTickets />} />
                        <Route path="/offers" element={<Offers />} />
                      </Route>

                      {/* Public Info Routes (No Location Required) */}
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/help-support" element={<HelpSupport />} />
                      <Route path="/user/auth/support" element={<HelpSupport />} />
                      <Route path="/profile/terms" element={<Terms />} />
                      <Route path="/profile/privacy" element={<Privacy />} />

                      {/* Provider Routes */}
                      <Route path="/provider" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderDashboard /></ProtectedRoute>} />
                      {/* Provider Routes (Standalone outside layout) */}
                      <Route path="/provider/register" element={<ProviderRegister />} />
                      <Route path="/sewak/register" element={<SewakRegister />} />
                      <Route path="/provider/login" element={<ProviderLogin />} />
                      <Route path="/provider/forgot-password" element={<ProviderForgotPassword />} />
                      <Route path="/digilocker/callback" element={<DigilockerCallback />} />

                      {/* Trainer Routes — standalone, self-contained auth (see TrainerProtectedRoute) */}
                      <Route path="/trainer/login" element={<TrainerLogin />} />
                      <Route path="/trainer/sessions" element={<TrainerProtectedRoute><TrainerSessions /></TrainerProtectedRoute>} />
                      <Route path="/trainer" element={<Navigate to="/trainer/sessions" replace />} />
                      <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderProfile /></ProtectedRoute>} />
                      <Route path="/provider/bookings" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderBookings /></ProtectedRoute>} />
                      <Route path="/provider/staff" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderStaff /></ProtectedRoute>} />
                      <Route path="/provider/earnings" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderEarnings /></ProtectedRoute>} />
                      <Route path="/provider/services" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderServices /></ProtectedRoute>} />
                      <Route path="/provider/skill-sessions" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderSkillSessions /></ProtectedRoute>} />
                      <Route path="/provider/kit-store" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><SewakKitStore /></ProtectedRoute>} />
                      <Route path="/provider/availability" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderAvailability /></ProtectedRoute>} />
                      <Route path="/provider/documents" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderDocuments /></ProtectedRoute>} />
                      <Route path="/provider/reviews" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderReviews /></ProtectedRoute>} />
                      <Route path="/provider/99card" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><Provider99Card /></ProtectedRoute>} />
                      <Route path="/provider/benefit-policy" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderBenefitPolicy /></ProtectedRoute>} />
                      <Route path="/provider/settings" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderSettings /></ProtectedRoute>} />
                      <Route path="/provider/support" element={<ProviderSupport />} />
                      <Route path="/provider/auth/support" element={<ProviderSupport />} />
                      <Route path="/provider/profile/terms" element={<Terms />} />
                      <Route path="/provider/profile/privacy" element={<Privacy />} />
                      <Route path="/provider/notifications" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderNotifications /></ProtectedRoute>} />
                      <Route path="/provider/wallet" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderWallet /></ProtectedRoute>} />
                      <Route path="/provider/subscriptions" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderSubscriptions /></ProtectedRoute>} />
                      <Route path="/provider/leads" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderLeads /></ProtectedRoute>} />
                      <Route path="/provider/banner-promotions" element={<ProtectedRoute allowedRoles={["provider", "sewak"]}><ProviderBannerPromotion /></ProtectedRoute>} />

                      {/* Admin Routes with Persistent Layout */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="hrm" element={<AdminHRM />} />
                        <Route path="supervisors" element={<AdminHRM view="supervisor" />} />
                        <Route path="employees" element={<AdminHRM view="employee" />} />
                        <Route path="providers" element={<AdminProviders />} />
                        <Route path="sewaks" element={<SewakManagement />} />
                        <Route path="sewak-enquiries" element={<AdminSewakEnquiries />} />
                        <Route path="verify-sewaks" element={<AdminVerifySewak />} />
                        <Route path="verify-employees" element={<AdminVerifyEmployee />} />
                        <Route path="verify-combos" element={<AdminVerifyCombo />} />
                        <Route path="bookings" element={<AdminBookings />} />
                        <Route path="leads" element={<AdminLeads />} />
                        <Route path="lead-forms" element={<AdminLeadForms />} />
                        <Route path="earnings" element={<AdminEarnings />} />
                        <Route path="coupons" element={<AdminCoupons />} />
                        <Route path="feedback" element={<AdminFeedback />} />
                        <Route path="support" element={<AdminSupport />} />
                        <Route path="services" element={<AdminServices />} />
                        <Route path="provider-subscriptions" element={<AdminProviderSubscriptions />} />
                        <Route path="subscriptions" element={<AdminSubscriptions />} />
                        <Route path="sewak-pricing" element={<SewakPricing />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="settings/cash-limits" element={<AdminCashLimits />} />
                        <Route path="partner-program" element={<PartnerProgramConfig />} />
                        <Route path="commission-analytics" element={<AdminCommissionAnalytics />} />
                        <Route path="benefit-policies" element={<AdminBenefitPolicies />} />
                        <Route path="disputes" element={<AdminDisputes />} />
                        <Route path="banners" element={<AdminBanners />} />
                        <Route path="provider-banners" element={<AdminProviderBanners />} />
                        <Route path="notifications" element={<AdminNotifications />} />
                        <Route path="activity-log" element={<AdminActivityLog />} />
                        <Route path="kyc" element={<AdminKYC />} />
                        <Route path="99cards" element={<Admin99Card />} />
                        <Route path="commission" element={<AdminCommission />} />
                        <Route path="audit-logs" element={<AdminAuditLogs />} />
                        <Route path="night-charge" element={<AdminNightCharge />} />
                        <Route path="distance-charges" element={<DistanceCharges />} />
                        <Route path="settings/service-radius" element={<AdminServiceRadius />} />
                        <Route path="sewak-incentives" element={<AdminSewakIncentives />} />
                        <Route path="unauthorized-payments" element={<AdminUnauthorizedPayments />} />
                        <Route path="fee-settings" element={<AdminFeeSettings />} />

                        <Route path="zones" element={<AdminZones />} />
                        <Route path="training-centers" element={<AdminTrainingCenters />} />
                        <Route path="trainers" element={<AdminTrainers />} />
                        <Route path="skill-sessions" element={<AdminSkillSessions />} />
                        <Route path="starter-kits" element={<AdminStarterKits />} />
                        <Route path="kit-combos" element={<AdminKitCombos />} />
                        <Route path="kit-payment-settings" element={<AdminKitPaymentSettings />} />
                        <Route path="kit-orders" element={<AdminKitOrders />} />
                        <Route path="dispatch" element={<AdminDispatch />} />
                        <Route path="emergency" element={<AdminEmergency />} />
                        <Route path="finance" element={<AdminFinance />} />
                        <Route path="provider-reports" element={<ProviderReports />} />
                        <Route path="reports" element={<AdminReports />} />
                        <Route path="withdrawals" element={<AdminWithdrawals />} />
                        <Route path="bazaar" element={<AdminBazaar />} />

                        <Route path="help-training" element={<AdminHelpTraining />} />
                        <Route path="super" element={<AdminSuper />} />
                      </Route>

                      <Route path="/admin/login" element={<AdminLogin />} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AnimatePresence>
                </ConfirmDialogProvider>
              </TooltipProvider>
            </QueryClientProvider>
          </SocketProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
