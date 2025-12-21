// src/App.tsx - Add these routes to your existing router configuration

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PlatformCallback from "./pages/PlatformCallback";
import { AuthProvider } from "./contexts/AuthContext";

import Auth from "./pages/Auth";
import Spaces from "./pages/Spaces";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

// NEW IMPORTS - Add these
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
            {/* Redirect root → auth */}
            <Route path="/" element={<Navigate to="/auth" replace />} />

            {/* Auth */}
            <Route path="/auth" element={<Auth />} />

            {/* NEW ROUTES - Add these 3 email verification routes */}
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verification-success" element={<VerificationSuccess />} />
            <Route path="/verification-failed" element={<VerificationFailed />} />

            {/* Spaces list */}
            <Route path="/spaces" element={<Spaces />} />

            {/* FULL CHAT INTERFACE PER SPACE */}
            <Route path="/chat/:spaceId" element={<Chat />} />
            <Route path="/platform/success" element={<PlatformCallback />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;