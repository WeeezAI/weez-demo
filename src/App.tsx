import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlatformCallback from "./pages/PlatformCallback";
import { AuthProvider } from "./contexts/AuthContext";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Spaces from "./pages/Spaces";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";

import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerificationFailed from "./pages/VerificationFailed";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
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
            <Route path="/platform/success" element={<PlatformCallback />} />

            {/* Legal pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
