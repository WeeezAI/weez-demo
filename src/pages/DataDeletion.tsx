import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Clock, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import HelpCenterModal from "@/components/HelpCenterModal";

const DataDeletion = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 md:px-12 py-6 border-b border-border">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-16">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Data Deletion Request</h1>
          <p className="text-muted-foreground text-lg">
            We respect your privacy and make it easy to delete your data.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">How to Request Data Deletion</h2>
          </div>

          <p className="text-muted-foreground mb-6 leading-relaxed">
            If you would like to delete your account and all associated data from Weez.AI,
            please contact us through our Help Center.
          </p>

          <div className="bg-background rounded-xl p-6 border border-border mb-6">
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Action:</span>
                <p className="font-semibold text-lg text-foreground">Submit a "Data Deletion" request via Help Center</p>
              </div>
            </div>
          </div>

          <Button
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors w-full md:w-auto"
            onClick={() => setIsHelpOpen(true)}
          >
            <Mail className="h-4 w-4" />
            Open Help Center
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            *If you cannot access the Help Center, you may also email us directly at <a href="mailto:support@dexraflow.com" className="text-primary hover:underline">support@dexraflow.com</a>.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="font-semibold">Fast Processing</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Our team will process your data deletion request within <strong className="text-foreground">24 hours</strong> of receiving your email.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="font-semibold">Complete Removal</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              All your personal data, generated content, and account information will be permanently deleted from our systems.
            </p>
          </div>
        </div>

        {/* What Gets Deleted */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-4">What Will Be Deleted</h3>
          <ul className="space-y-3">
            {[
              "Your account credentials and profile information",
              "All generated content and creative assets",
              "Connected platform data and integrations",
              "Analytics and usage history",
              "All stored preferences and settings"
            ].map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Additional Info */}
        <div className="border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            For any questions about data deletion or privacy concerns, please refer to our{" "}
            <Link to="/privacy-policy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            or contact us at{" "}
            <a href="mailto:support@dexraflow.com" className="text-primary hover:underline">
              support@dexraflow.com
            </a>.
          </p>
        </div>
      </div>

      <HelpCenterModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default DataDeletion;
