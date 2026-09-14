import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useSearchParams, Navigate, useParams } from "react-router-dom";
import PlatformCallback from "./pages/PlatformCallback";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CreditsProvider } from "@/hooks/useCredits";
import { TutorialProvider } from "./contexts/TutorialContext";
import { TutorialSpotlight } from "./components/tutorial/TutorialSpotlight";
import { TutorialTooltip } from "./components/tutorial/TutorialTooltip";
import { Loader2 } from "lucide-react";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Spaces from "./pages/Spaces";
import Chat from "./pages/Chat";
import Gallery from "./pages/Gallery";
import OneClickPost from "./pages/OneClickPost";
import AutonomousMarketing from "./pages/AutonomousMarketing";
import Connections from "./pages/Connections";
import LinkedInAnalytics from "./pages/LinkedInAnalytics";
import SalesAssistant from "./pages/SalesAssistant";
import SalesIntelligence from "./pages/SalesIntelligence";
import SalesWorkspace from "./pages/SalesWorkspace";
import Meetings from "./pages/Meetings";
import GrowthStrategist from "./pages/GrowthStrategist";
import Max from "./pages/Max";
import Eva from "./pages/Eva";
import Ninna from "./pages/Ninna";
import MarketDiscovery from "./pages/MarketDiscovery";
import RevenueIntelligence from "./pages/RevenueIntelligence";
import ProspectIntelligence from "./pages/ProspectIntelligence";
import GTMActionQueue from "./pages/GTMActionQueue";
import GTMDashboard from "./pages/GTMDashboard";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import DataDeletion from "./pages/DataDeletion";

import Plans from "./pages/Plans";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerificationFailed from "./pages/VerificationFailed";
import ApprovalConfirmation from "./pages/ApprovalConfirmation";
import InternalAnalytics from "./pages/InternalAnalytics";
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

const RedirectToMarketDiscovery = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  return <Navigate to={`/leads/${spaceId}?tab=market-discovery`} replace />;
};

const RedirectToRevenue = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  return <Navigate to={`/leads/${spaceId}?tab=revenue`} replace />;
};

/**
 * `/relationship-intelligence/:spaceId` → the dossier.
 *
 * One prospect is one surface now: `GTMProspect.tsx` folded into
 * `ProspectIntelligence.tsx`, so the old execution path has no page of its own to
 * render. It survives as a redirect rather than a removal because deep links to it are
 * already out there — in browser history, in shared URLs — and a 404 on one of them
 * would read as lost data. `replace` keeps the retired path out of the back stack, so
 * Back from the dossier goes wherever the rep actually came from.
 */
const RedirectToProspectIntelligence = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  return <Navigate to={`/prospect-intelligence/${spaceId}`} replace />;
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
      {/* The credit balance, read once per workspace rather than once per page.
          Inside `BrowserRouter` because it derives the workspace from the path, and above
          `Routes` because it is workspace-level chrome: four surfaces price their controls
          from it, and making each of them fetch it would add a request to every page for a
          number that does not change between them. */}
      <CreditsProvider>
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

              {/* Internal staff-only analytics (static credential gate) */}
              <Route path="/internal" element={<InternalAnalytics />} />

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
              <Route path="/one-click-post/:spaceId" element={<OneClickPost />} />
              <Route path="/autonomous-marketing/:spaceId" element={<AutonomousMarketing />} />
              {/* Standalone Connections page (decoupled from Autonomous Marketing) */}
              <Route path="/connections/:spaceId" element={<Connections />} />
              <Route path="/linkedin-analytics/:spaceId" element={<LinkedInAnalytics />} />
              {/* Max — AI Outbound & Relationship-Intelligence command center
                  (replaces the old Sales page). The legacy lead/CRM view is
                  kept at /leads so Market Discovery & Revenue tabs still work. */}
              <Route path="/sales/:spaceId" element={<Max />} />
              <Route path="/leads/:spaceId" element={<SalesAssistant />} />
              <Route path="/sales-intelligence/:spaceId" element={<SalesIntelligence />} />
              {/* Meetings — the booked pipeline, styled with the Eva/Max shell.
                  The legacy SalesWorkspace CRM it replaced is kept below on its own
                  path so nothing that deep-links to it breaks. */}
              <Route path="/sales-workspace/:spaceId" element={<Meetings />} />
              <Route path="/sales-workspace-legacy/:spaceId" element={<SalesWorkspace />} />
              <Route path="/growth/:spaceId" element={<GrowthStrategist />} />
              {/* Ninna — the AI GTM Strategist Command Center. Default homepage
                  of every workspace; the single interface that orchestrates EVA
                  and MAX and reports up to the founder. */}
              <Route path="/ninna/:spaceId" element={<Ninna />} />
              <Route path="/eva/:spaceId" element={<Eva />} />
              {/* Prospect Intelligence — the AI reasoning layer between EVA and MAX. */}
              <Route path="/prospect-intelligence/:spaceId" element={<ProspectIntelligence />} />
              {/* Relationship Intelligence — retired as a destination. Its content folded
                  into the dossier above, so this path only forwards there now. */}
              <Route
                path="/relationship-intelligence/:spaceId"
                element={<RedirectToProspectIntelligence />}
              />
              {/* Action Queue — the cross-prospect ranked queue of live GTM
                  recommendations. Read-only; :spaceId is the brand id, as above. */}
              <Route path="/action-queue/:spaceId" element={<GTMActionQueue />} />
              {/* GTM Dashboard — the seven aggregate statements, each linking to the
                  rows behind it. Read-only; :spaceId is the brand id, as above.
                  Kept as a compatibility route: off the sidebar, still reachable. */}
              <Route path="/gtm-dashboard/:spaceId" element={<GTMDashboard />} />
              {/* Analytics — the day-by-day read of the loop. One row per calendar day,
                  read-only; :spaceId is the brand id, as above. */}
              <Route path="/analytics/:spaceId" element={<Analytics />} />
              <Route path="/market-discovery/:spaceId" element={<RedirectToMarketDiscovery />} />
              <Route path="/revenue-intelligence/:spaceId" element={<RedirectToRevenue />} />
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
      </CreditsProvider>
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
