// src/pages/VerificationFailed.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerificationFailed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorType, setErrorType] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Get error type from URL
    const error = searchParams.get("error");

    setErrorType(error || "unknown");

    // Set appropriate error message
    switch (error) {
      case "invalid_token":
        setErrorMessage("The verification link is invalid or has been tampered with.");
        break;
      case "expired_token":
        setErrorMessage("The verification link has expired. Verification links are valid for 24 hours.");
        break;
      case "already_verified":
        setErrorMessage("This email address has already been verified.");
        break;
      default:
        setErrorMessage("An unknown error occurred during verification.");
    }
  }, [searchParams]);

  const handleBackToAuth = () => {
    navigate("/auth");
  };

  const handleTryAgain = () => {
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

        {/* Error Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Verification Failed
            </h2>

            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>

            {/* Error Details Box */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground mb-1">
                    What should I do?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {errorType === "expired_token" && 
                      "Please register again to receive a new verification email."}
                    {errorType === "invalid_token" && 
                      "Please register again or contact support if this problem persists."}
                    {errorType === "already_verified" && 
                      "You can log in directly using your credentials."}
                    {!["expired_token", "invalid_token", "already_verified"].includes(errorType) && 
                      "Please try again or contact support for assistance."}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {errorType === "already_verified" ? (
                <Button
                  onClick={handleBackToAuth}
                  className="w-full bg-primary hover:bg-primary/90 h-11"
                >
                  Go to Login
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleTryAgain}
                    className="w-full bg-primary hover:bg-primary/90 h-11"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={handleBackToAuth}
                    variant="outline"
                    className="w-full h-11"
                  >
                    Back to Auth
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Support Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Still having trouble?{" "}
            <a
              href="mailto:support@weez.ai"
              className="text-primary hover:underline font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationFailed;