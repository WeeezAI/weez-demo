import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlatformCallback from "./pages/PlatformCallback";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { TutorialSpotlight } from "./components/tutorial/TutorialSpotlight";
import { TutorialTooltip } from "./components/tutorial/TutorialTooltip";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Spaces from "./pages/Spaces";
import Chat from "./pages/Chat";
import Gallery from "./pages/Gallery";
import Analytics from "./pages/Analytics";
import OneClickPost from "./pages/OneClickPost";
import AutonomousMarketing from "./pages/AutonomousMarketing";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import DataDeletion from "./pages/DataDeletion";

import Plans from "./pages/Plans";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerificationFailed from "./pages/VerificationFailed";
import PremiumModal from "./components/PremiumModal";
import { differenceInDays, parseISO } from "date-fns";

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

              {/* Spaces list */}
              <Route path="/spaces" element={<Spaces />} />

              {/* Chat interface per space */}
              <Route path="/chat/:spaceId" element={<Chat />} />
              <Route path="/gallery/:spaceId" element={<Gallery />} />
              <Route path="/analytics/:spaceId" element={<Analytics />} />
              <Route path="/one-click-post/:spaceId" element={<OneClickPost />} />
              <Route path="/autonomous-marketing/:spaceId" element={<AutonomousMarketing />} />
              <Route path="/platform/success" element={<PlatformCallback />} />

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
