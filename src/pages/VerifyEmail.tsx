// src/pages/VerifyEmail.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Get email from URL params (passed from registration)
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }

    // Check if redirected from verification link
    const messageParam = searchParams.get("message");
    const errorParam = searchParams.get("error");

    if (messageParam === "already_verified") {
      setStatus("error");
      setMessage("This email is already verified. Please log in.");
    } else if (errorParam === "invalid_token") {
      setStatus("error");
      setMessage("Invalid verification link. Please try registering again.");
    } else if (errorParam === "expired_token") {
      setStatus("error");
      setMessage("Verification link has expired. Please register again.");
    }
  }, [searchParams]);

  const handleResendEmail = async () => {
    // TODO: Implement resend email functionality
    setMessage("Resend functionality coming soon...");
  };

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

        {/* Verification Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {status === "pending" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-10 h-10 text-primary" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Check Your Email
              </h2>

              <p className="text-muted-foreground mb-6">
                We've sent a verification link to
              </p>

              {email && (
                <div className="bg-muted/50 rounded-lg p-3 mb-6">
                  <p className="text-sm font-medium text-foreground">{email}</p>
                </div>
              )}

              <div className="space-y-3 text-sm text-muted-foreground mb-6">
                <p>
                  Click the verification link in the email to complete your registration.
                </p>
                <p className="text-xs">
                  The link will expire in 24 hours.
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground mb-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for verification...</span>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Didn't receive the email?
                </p>
                <Button
                  variant="outline"
                  onClick={handleResendEmail}
                  className="w-full"
                >
                  Resend Verification Email
                </Button>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Email Verified!
              </h2>

              <p className="text-muted-foreground mb-6">
                Your account has been created successfully. You can now log in.
              </p>

              <Button
                onClick={handleGoToLogin}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Go to Login
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Verification Failed
              </h2>

              <p className="text-muted-foreground mb-6">
                {message || "Something went wrong with your verification."}
              </p>

              <Button
                onClick={handleGoToLogin}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>

        {/* Additional Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
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

export default VerifyEmail;