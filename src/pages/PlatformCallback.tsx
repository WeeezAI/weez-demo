import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  Instagram,
  Facebook,
  ArrowRight,
  Mail,
  CalendarCheck,
  Send,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { weezAPI } from "@/services/weezAPI";
import { EducationalLoader } from "@/components/EducationalLoader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LinkedInLogo,
  GmailLogo,
  OutlookLogo,
  GoogleCalendarLogo,
} from "@/components/brand-logos";

const PlatformCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pages, setPages] = useState<Array<{ urn: string; name: string; type: "personal" | "organization" }>>([]);
  const [selectedPageUrn, setSelectedPageUrn] = useState<string>("");
  const [isFetchingPages, setIsFetchingPages] = useState(false);
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [hasSelectedPage, setHasSelectedPage] = useState(false);

  const isConnected = params.get("connected") === "true";
  const brandId = params.get("state") || "";
  const error = params.get("error");

  // Enriched Meta Data
  const username = params.get("username");
  const pageName = params.get("page_name");
  const provider = params.get("provider") || "instagram";
  // The real, human-readable failure reason forwarded by the backend callback
  // (e.g. a Microsoft "AADSTS…" message) so we can show WHAT went wrong.
  const errorDetail = params.get("detail") || "";
  const isMailbox = ["microsoft", "outlook", "google", "gmail"].includes(provider);
  const isLinkedIn = provider === "linkedin";
  const providerLabel =
    (
      {
        instagram: "Instagram",
        facebook: "Facebook",
        linkedin: "LinkedIn",
        hubspot: "HubSpot",
        microsoft: "Outlook",
        outlook: "Outlook",
        google: "Gmail",
        gmail: "Gmail",
        google_calendar: "Google Calendar",
      } as Record<string, string>
    )[provider] || "your account";

  // ── Provider visual identity (brand logo + capabilities shown on success) ──
  const renderProviderLogo = (className = "h-9 w-9") => {
    if (isLinkedIn) return <LinkedInLogo className={className} />;
    if (provider === "google" || provider === "gmail") return <GmailLogo className={className} />;
    if (provider === "microsoft" || provider === "outlook") return <OutlookLogo className={className} />;
    if (provider === "google_calendar") return <GoogleCalendarLogo className={className} />;
    if (provider === "instagram") return <Instagram className={`${className} text-pink-500`} />;
    if (provider === "facebook") return <Facebook className={`${className} text-blue-600`} />;
    return <Mail className={`${className} text-zinc-500`} />;
  };

  const capabilities: Array<{ icon: typeof Send; label: string }> = isMailbox
    ? [
        { icon: Send, label: "Outbound email enabled" },
        { icon: CalendarCheck, label: "Meeting booking ready" },
      ]
    : isLinkedIn
      ? [
          { icon: Megaphone, label: "B2B publishing enabled" },
          { icon: Sparkles, label: "Professional voice synced" },
        ]
      : [
          { icon: Sparkles, label: "Brand identity synchronized" },
          { icon: Send, label: "Publishing enabled" },
        ];

  useEffect(() => {
    if (isConnected && brandId && !isSuccess) {
      if (provider === "linkedin") {
        fetchLinkedInPages(brandId);
      } else if (provider === "hubspot") {
        setIsSuccess(true);
      } else {
        setIsSuccess(true);
        toast.success(`${providerLabel} connected successfully!`);
      }
    }
  }, [isConnected, brandId, provider, isSuccess]);

  const fetchLinkedInPages = async (id: string) => {
    setIsFetchingPages(true);
    try {
      const data = await weezAPI.getLinkedInPages(id);
      setPages(data.pages || []);
      if (data.pages && data.pages.length > 0) {
        const current = data.current_urn || data.pages[0].urn;
        setSelectedPageUrn(current);
      }
    } catch (err) {
      console.error("Failed to fetch LinkedIn pages:", err);
      toast.error("Could not fetch LinkedIn pages");
    } finally {
      setIsFetchingPages(false);
    }
  };

  const handleConfirmLinkedInPage = async () => {
    if (!selectedPageUrn) {
      toast.error("Please select a page or profile.");
      return;
    }
    const page = pages.find((p) => p.urn === selectedPageUrn);
    if (!page) return;

    setIsSavingPage(true);
    try {
      await weezAPI.selectLinkedInPage(brandId, page.urn, page.name);
      setHasSelectedPage(true);
      setIsSuccess(true);
      toast.success(`Successfully connected to ${page.name}!`);
    } catch (err) {
      console.error("Failed to select page:", err);
      toast.error("Failed to save LinkedIn page selection");
    } finally {
      setIsSavingPage(false);
    }
  };

  const handleTryAgain = () => {
    navigate("/spaces");
  };

  // ── Skeleton shown while we finalize the connection / fetch LinkedIn pages ──
  const renderSkeleton = (caption: string) => (
    <div className="space-y-8">
      <div className="flex justify-center">
        <Skeleton className="h-24 w-24 rounded-[2rem]" />
      </div>
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-8 w-64 rounded-xl" />
        <Skeleton className="mx-auto h-4 w-80 rounded-lg" />
      </div>
      <div className="space-y-3 rounded-[2rem] border border-border/60 bg-white p-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-40">
        {caption}
      </p>
    </div>
  );

  const renderFailure = () => {
    let title = "Connection Failed";
    let description = `We couldn't connect your ${providerLabel} account.`;
    let steps: string[] = [];

    if (error === "no_ig_business_found") {
      title = "Instagram Not Detected";
      description = "We found your Facebook Pages, but no Instagram Business account is linked to them.";
      steps = [
        "Open Instagram app → Settings → Business → Connect Facebook Page",
        "Ensure you have 'Full Control' of the linked Facebook Page",
        "Log out of Facebook and log back in to refresh permissions",
        "If the Page was created by another account, ask the owner to grant you Full Control",
      ];
    } else if (error === "no_pages_found") {
      title = "No Pages Found";
      description = "Your Facebook account doesn't seem to manage any Facebook Pages.";
      steps = [
        "Ensure you have a Facebook Page for your business",
        "Verify you are an Admin of that Facebook Page",
        "Try creating a fresh Page if your legacy one is restricted",
      ];
    } else if (isMailbox) {
      if (error === "store_failed") {
        title = `${providerLabel} Not Saved`;
        description = `${providerLabel} authorized successfully, but we couldn't save the connection. Please try connecting again.`;
      } else if (error === "access_denied" || error === "consent_required") {
        title = "Permission Needed";
        description = `Connecting ${providerLabel} needs you to grant the requested mail permissions. Please try again and accept the consent screen.`;
      } else {
        title = `Couldn't Finish Connecting ${providerLabel}`;
        description = `Sign-in completed, but the final authorization step failed.${errorDetail ? ` ${providerLabel} reported the reason below.` : ""}`;
        steps = [
          "Retry the connection — transient provider errors often clear on a second try",
          "Make sure you're signing in with the mailbox you intend to send from",
          "If it keeps failing, the app's OAuth settings may need attention (redirect URI, client secret, or allowed account types)",
        ];
      }
    }

    return (
      <div className="space-y-8 text-left duration-500 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-amber-500/10">
            <AlertCircle className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{title}</h1>
          <p className="font-medium text-muted-foreground">{description}</p>
        </div>

        {errorDetail && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/80">
              Reason from {providerLabel}
            </p>
            <p className="break-words text-sm font-medium leading-relaxed text-foreground/80">{errorDetail}</p>
          </div>
        )}

        {steps.length > 0 && (
          <div className="space-y-5 rounded-[2rem] border border-border/50 bg-white p-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">
              Guided Troubleshooting
            </h3>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="group flex items-start gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[10px] font-black transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                    {i + 1}
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-foreground/80">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleTryAgain}
            className="h-14 w-full rounded-2xl bg-foreground text-[11px] font-black uppercase tracking-widest text-white"
          >
            Try Again
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/spaces")}
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Return to Spaces
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    // After a LinkedIn or mailbox connect, land on the standalone Connections
    // page so the user immediately sees the connected status. Other providers
    // (e.g. Instagram) still go to their dashboard hub. Falls back to /spaces.
    const connectionsHref = brandId ? `/connections/${brandId}` : "/spaces";
    const successDestination =
      isLinkedIn || isMailbox ? connectionsHref : `/one-click-post/${brandId}`;

    const identifier = isMailbox
      ? username || ""
      : provider === "instagram"
        ? username || pageName || ""
        : "";

    return (
      <div className="space-y-8 text-left duration-500 animate-in fade-in slide-in-from-bottom-4">
        {/* Logo + success badge */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-zinc-100 bg-white shadow-xl shadow-black/[0.04]">
              {renderProviderLogo("h-12 w-12")}
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center">
              <span className="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-emerald-400/30" />
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30 duration-500 animate-in zoom-in">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </span>
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Connected</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{providerLabel} is linked</h1>
          <p className="mx-auto max-w-md font-medium text-muted-foreground">
            {isMailbox
              ? `Your ${providerLabel} mailbox is connected — Max can now send outbound email and book meetings from it.`
              : isLinkedIn
                ? "Your LinkedIn is connected and ready for B2B publishing."
                : "Your account is connected and synchronized."}
          </p>
        </div>

        {/* Capability card */}
        <div className="space-y-4 rounded-[2rem] border border-border/70 bg-white p-6 shadow-xl shadow-black/[0.02]">
          {identifier && (
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50">
                {renderProviderLogo("h-6 w-6")}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                  Account
                </span>
                <span className="truncate text-sm font-bold text-foreground">{identifier}</span>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.label} className="flex items-center gap-3 rounded-2xl bg-zinc-50/80 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Icon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-bold text-foreground/80">{cap.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          onClick={() => navigate(successDestination)}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[11px] font-black uppercase tracking-widest text-white shadow-2xl shadow-primary/20 transition-all hover:bg-accent"
        >
          {isLinkedIn || isMailbox ? "View connections" : "Enter dashboard"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const renderLinkedInPagePicker = () => (
    <div className="space-y-8 text-left duration-500 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-zinc-100 bg-white shadow-xl shadow-black/[0.04]">
          <LinkedInLogo className="h-12 w-12" />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Choose your page</h1>
        <p className="mx-auto max-w-md font-medium text-muted-foreground">
          We found multiple profiles or pages on your LinkedIn account. Pick where you want to publish and run marketing.
        </p>
      </div>

      <div className="space-y-4 rounded-[2rem] border border-border/70 bg-white p-6 shadow-xl shadow-black/[0.02]">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
          Destination profile or organization
        </label>
        <select
          value={selectedPageUrn}
          onChange={(e) => setSelectedPageUrn(e.target.value)}
          className="h-14 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 font-semibold text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          {pages.map((p) => (
            <option key={p.urn} value={p.urn}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-xs font-medium leading-relaxed text-zinc-400">
          Weez AI will tailor content for this page. You can change this later in your connections settings.
        </p>
      </div>

      <Button
        onClick={handleConfirmLinkedInPage}
        disabled={isSavingPage}
        className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[11px] font-black uppercase tracking-widest text-white shadow-2xl shadow-primary/20 transition-all hover:bg-accent disabled:opacity-70"
      >
        {isSavingPage ? "Saving…" : (
          <>
            Confirm &amp; continue <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );

  const renderBody = () => {
    if (isAnalyzing) return <EducationalLoader />;
    if (isFetchingPages) return renderSkeleton("Fetching your LinkedIn pages");
    if (provider === "linkedin" && !hasSelectedPage && pages.length > 0) return renderLinkedInPagePicker();
    if (isSuccess) return renderSuccess();
    if (error) return renderFailure();
    return renderSkeleton("Finalizing your connection");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBFF] p-6 font-sans">
      <div className="w-full max-w-md">{renderBody()}</div>
    </div>
  );
};

export default PlatformCallback;
