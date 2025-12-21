// src/pages/VerificationSuccess.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerificationSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/auth");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleGoToLogin = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Weez.AI</h1>
            <p className="text-sm text-muted-foreground">Future of Digital Marketing</p>
          </div>
        </div>

        {/* Success Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="text-center">
            {/* Success Icon with animation */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Email Verified Successfully!
            </h2>

            <p className="text-muted-foreground mb-6">
              Your account has been verified. You can now log in and start using Weez.AI.
            </p>

            {/* Success Details */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-6">
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center justify-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Account verified</span>
                </p>
                <p className="flex items-center justify-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Ready to log in</span>
                </p>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleGoToLogin}
              className="w-full bg-primary hover:bg-primary/90 h-11 mb-4"
            >
              Go to Login
            </Button>

            {/* Auto-redirect notice */}
            <p className="text-xs text-muted-foreground">
              Redirecting to login in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Welcome to Weez.AI! Ready to transform your digital marketing?
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationSuccess;