import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import PlatformCallback from "./pages/PlatformCallback";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { TutorialSpotlight } from "./components/tutorial/TutorialSpotlight";
import { TutorialTooltip } from "./components/tutorial/TutorialTooltip";
import { Loader2 } from "lucide-react";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Spaces from "./pages/Spaces";
import Chat from "./pages/Chat";
import Gallery from "./pages/Gallery";
import Analytics from "./pages/Analytics";
import OneClickPost from "./pages/OneClickPost";
import AutonomousMarketing from "./pages/AutonomousMarketing";
import LinkedInAnalytics from "./pages/LinkedInAnalytics";
import SalesAssistant from "./pages/SalesAssistant";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import DataDeletion from "./pages/DataDeletion";

import Plans from "./pages/Plans";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerificationFailed from "./pages/VerificationFailed";
import ApprovalConfirmation from "./pages/ApprovalConfirmation";
import PremiumModal from "./components/PremiumModal";
import { differenceInDays, parseISO } from "date-fns";
import CONFIG from "./services/config";

const HubSpotCallbackRedirect = () => {
  const [params] = useSearchParams();
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      window.location.replace(`${CONFIG.WEEZ_BASE_URL}/hubspot/callback?code=${code}&state=${state}`);
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBFF]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-40">Finalizing CRM Sync</p>
      </div>
    </div>
  );
};

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, isAuthenticated } = useAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Trial Logic
  const daysUsed = user?.created_at ? differenceInDays(new Date(), parseISO(user.created_at)) : 0;
  const daysRemaining = Math.max(0, 14 - daysUsed);
  const isExpired = user?.plan_type === "free" && daysUsed >= 14;

  useEffect(() => {
    // Check if user just registered (new session, no space yet, or similar signal)
    // For now, let's show it if they are on a free plan and either just joined or expired.
    if (isAuthenticated && user?.plan_type === "free") {
      const hasSeenModal = sessionStorage.getItem("weez_premium_modal_shown");
      if (!hasSeenModal || isExpired) {
        setShowPremiumModal(true);
        sessionStorage.setItem("weez_premium_modal_shown", "true");
      }
    }
  }, [isAuthenticated, user?.plan_type, isExpired]);

  return (
    <>
      <TutorialProvider>
        <TutorialSpotlight />
        <TutorialTooltip />
        <PremiumModal 
          isOpen={showPremiumModal} 
          onClose={() => setShowPremiumModal(false)} 
          daysRemaining={daysRemaining}
          isExpired={isExpired}
        />
        <Routes>
              {/* Landing Page */}
              <Route path="/" element={<Landing />} />

              {/* Auth */}
              <Route path="/auth" element={<Auth />} />

              {/* Email verification routes */}
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verification-success" element={<VerificationSuccess />} />
              <Route path="/verification-failed" element={<VerificationFailed />} />

              {/* Approval workflow — destination of email "Approve Post" links (Req 7.5, 21.x) */}
              <Route
                path="/campaign/:campaignId/approve/:contentId"
                element={<ApprovalConfirmation />}
              />

              {/* Spaces list */}
              <Route path="/spaces" element={<Spaces />} />

              {/* Chat interface per space */}
              <Route path="/chat/:spaceId" element={<Chat />} />
              <Route path="/gallery/:spaceId" element={<Gallery />} />
              <Route path="/analytics/:spaceId" element={<Analytics />} />
              <Route path="/one-click-post/:spaceId" element={<OneClickPost />} />
              <Route path="/autonomous-marketing/:spaceId" element={<AutonomousMarketing />} />
              <Route path="/linkedin-analytics/:spaceId" element={<LinkedInAnalytics />} />
              <Route path="/sales/:spaceId" element={<SalesAssistant />} />
              <Route path="/platform/success" element={<PlatformCallback />} />
              <Route path="/integrations/hubspot/callback" element={<HubSpotCallbackRedirect />} />

              {/* Legal pages */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-conditions" element={<TermsConditions />} />
              <Route path="/data-deletion" element={<DataDeletion />} />
              <Route path="/plans" element={<Plans />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
        </Routes>
      </TutorialProvider>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
