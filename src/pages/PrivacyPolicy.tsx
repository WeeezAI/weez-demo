import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Weez.AI by Dexraflow, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect minimal data necessary to provide our services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Account information (email address, name)</li>
              <li>Files and documents you upload for AI processing</li>
              <li>Usage data to improve our services</li>
              <li>Communication preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Retention & AI Training</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">We do not store your uploaded data, nor do we use it to train our AI models.</strong> Your uploaded files and documents are processed in real-time and are not stored on our servers after processing. We believe your data belongs to you, and we have no interest in keeping it beyond what's necessary to provide our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Brand Information Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We understand the importance of your brand's identity. Any information related to your brand (such as brand voice, assets, and guidelines) that you choose to save is stored very securely using industry-standard encryption. This allows us to provide personalized content generation without compromising your intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Data</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Your data is used solely to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide AI-powered document intelligence and marketing automation</li>
              <li>Process your files and generate insights</li>
              <li>Communicate with you about your account and services</li>
              <li>Improve our platform and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you connect third-party services (Google Drive, Dropbox, Slack, etc.), we only access the data you explicitly authorize. We do not share your data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your information during transmission and processing. All data is encrypted using TLS/SSL protocols.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and all associated data</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="bg-primary/10 border border-primary/20 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Delete Your Account & Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can request complete deletion of your account and all associated data at any time by emailing us at{" "}
              <a href="mailto:support@dexraflow.com" className="text-primary hover:underline font-medium">
                support@dexraflow.com
              </a>
              . We will process your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:support@dexraflow.com" className="text-primary hover:underline">
                support@dexraflow.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
