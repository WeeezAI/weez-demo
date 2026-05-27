// src/components/PublishingControls.tsx
//
// Publishing Controls section for the Campaign Settings dashboard.
//
// Implements:
//   - Req 1.1  Mode toggle with values "Approval Mode" and "AutoPilot"
//   - Req 1.3  Display the currently persisted publishing mode for the campaign
//   - Req 1.4  Persist a confirmed mode change via approvalAPI.setPublishingMode
//   - Req 2.1  Premium Upgrade Modal copy and buttons (exact strings)
//   - Req 2.2  Non-Premium click on AutoPilot keeps the persisted mode unchanged
//   - Req 2.3  "Cancel" closes the modal and leaves the toggle on Approval Mode
//   - Req 2.4  "Upgrade to Premium" navigates to the upgrade flow
//   - Req 2.5  On a 403 + code="premium_required" response, open the upgrade
//              modal and revert the local toggle
//   - Req 3.1  AutoPilot confirmation dialog copy and buttons (exact strings)
//   - Req 3.2  Confirming "Enable AutoPilot" persists AUTOPILOT
//   - Req 3.3  "Cancel" leaves the persisted mode unchanged
//   - Req 3.4  Toggling AutoPilot -> Approval Mode does NOT show a confirmation
//
// This is a self-contained presentational + container component: it owns the
// toggle state, the two dialog flows, and the call into approvalAPI. The
// parent passes `campaignId` and `isPremium`; the component is otherwise
// agnostic to the surrounding page.

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Sparkles, AlertTriangle, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import {
  approvalAPI,
  ApprovalAPIError,
  type ModeUsed,
} from "@/services/approvalAPI";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PublishingControlsProps {
  /** Campaign whose publishing mode this control mutates. */
  campaignId: string;
  /**
   * Whether the current user has a Premium subscription. The component still
   * defends against client-side spoofing by relying on the backend's 403
   * `premium_required` response (Req 2.5), but uses this flag to choose the
   * right dialog flow up front (Req 2.1 vs Req 3.1).
   */
  isPremium: boolean;
  /** Optional override for the upgrade-flow route. Defaults to `/plans`. */
  upgradeUrl?: string;
  /** Notified after a successful mode change is persisted. */
  onModeChange?: (mode: ModeUsed) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants — exact copy required by Req 2.1 and Req 3.1
// ---------------------------------------------------------------------------

const PREMIUM_MODAL_TITLE = "Unlock AutoPilot";
const PREMIUM_MODAL_DESCRIPTION =
  "Enable fully automated campaign execution. AI will generate, schedule, and publish campaign content automatically.";
const PREMIUM_MODAL_BENEFITS: readonly string[] = [
  "Automatic posting",
  "No approval required",
  "AI managed campaign execution",
  "End-to-end automation",
];
const PREMIUM_MODAL_PRIMARY = "Upgrade to Premium";
const PREMIUM_MODAL_SECONDARY = "Cancel";

const CONFIRM_DIALOG_TITLE = "Enable AutoPilot?";
const CONFIRM_DIALOG_DESCRIPTION =
  "Once enabled, AI will automatically generate and publish campaign content based on campaign schedule.";
const CONFIRM_DIALOG_WARNING = "No approval emails will be required.";
const CONFIRM_DIALOG_PRIMARY = "Enable AutoPilot";
const CONFIRM_DIALOG_SECONDARY = "Cancel";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PublishingControls: React.FC<PublishingControlsProps> = ({
  campaignId,
  isPremium,
  upgradeUrl = "/plans",
  onModeChange,
  className,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Persisted server mode (source of truth for the toggle's visual state).
  const [persistedMode, setPersistedMode] = useState<ModeUsed | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // ── Initial load (Req 1.3) ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    approvalAPI
      .getPublishingMode(campaignId)
      .then((res) => {
        if (cancelled) return;
        setPersistedMode(res.mode);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof ApprovalAPIError ? err.message : "Failed to load publishing mode.";
        setLoadError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // ── Persistence helper ─────────────────────────────────────────────────────
  const persistMode = useCallback(
    async (mode: ModeUsed) => {
      setSaving(true);
      try {
        const res = await approvalAPI.setPublishingMode(campaignId, mode);
        setPersistedMode(res.mode);
        onModeChange?.(res.mode);
        toast({
          title: mode === "AUTOPILOT" ? "AutoPilot enabled" : "Approval Mode enabled",
          description:
            mode === "AUTOPILOT"
              ? "New content will be auto-approved and published on schedule."
              : "New content will require your approval before publishing.",
        });
      } catch (err: unknown) {
        // Req 2.5: on 403 + premium_required, open upgrade modal and revert.
        if (
          err instanceof ApprovalAPIError &&
          err.status === 403 &&
          err.code === "premium_required"
        ) {
          // Persisted mode is unchanged on the server (Req 2.2); just open
          // the upgrade modal. The toggle visual is bound to `persistedMode`
          // which we never optimistically advanced, so nothing to revert.
          setPremiumModalOpen(true);
        } else {
          const msg =
            err instanceof ApprovalAPIError
              ? err.message
              : "Failed to update publishing mode.";
          toast({
            title: "Could not update publishing mode",
            description: msg,
            variant: "destructive",
          });
        }
      } finally {
        setSaving(false);
      }
    },
    [campaignId, onModeChange, toast],
  );

  // ── Toggle click handlers (Req 1.1, Req 2.1, Req 3.1, Req 3.4) ─────────────
  const requestApprovalMode = useCallback(() => {
    if (persistedMode === "APPROVAL" || saving || loading) return;
    // Req 3.4: AutoPilot -> Approval requires no confirmation dialog.
    void persistMode("APPROVAL");
  }, [persistedMode, saving, loading, persistMode]);

  const requestAutopilotMode = useCallback(() => {
    if (persistedMode === "AUTOPILOT" || saving || loading) return;

    if (!isPremium) {
      // Req 2.1 / 2.2: open upgrade modal, do NOT change persisted mode.
      setPremiumModalOpen(true);
      return;
    }

    // Req 3.1: open confirmation dialog. Persistence happens only on confirm.
    setConfirmDialogOpen(true);
  }, [persistedMode, saving, loading, isPremium]);

  // ── Dialog handlers ────────────────────────────────────────────────────────
  const handleConfirmEnableAutopilot = useCallback(() => {
    setConfirmDialogOpen(false);
    void persistMode("AUTOPILOT");
  }, [persistMode]);

  const handleCancelEnableAutopilot = useCallback(() => {
    // Req 3.3: leave persisted mode unchanged. Toggle is bound to
    // `persistedMode` so nothing visual to revert.
    setConfirmDialogOpen(false);
  }, []);

  const handleUpgradeClick = useCallback(() => {
    // Req 2.4
    setPremiumModalOpen(false);
    navigate(upgradeUrl);
  }, [navigate, upgradeUrl]);

  const handleCancelUpgrade = useCallback(() => {
    // Req 2.3
    setPremiumModalOpen(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const isApproval = persistedMode === "APPROVAL";
  const isAutopilot = persistedMode === "AUTOPILOT";
  const disabled = loading || saving || loadError !== null;

  return (
    <section
      aria-labelledby="publishing-controls-heading"
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-sm",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2
            id="publishing-controls-heading"
            className="text-base font-semibold tracking-tight"
          >
            Publishing Controls
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how AI-generated campaign content reaches your audience.
          </p>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </span>
        )}
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {loadError}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Publishing mode"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <ModeOption
          label="Approval Mode"
          description="Review every post before it goes live."
          selected={isApproval}
          disabled={disabled}
          onClick={requestApprovalMode}
        />
        <ModeOption
          label="AutoPilot"
          description="AI publishes posts automatically on schedule."
          selected={isAutopilot}
          disabled={disabled}
          badge={!isPremium ? "Premium" : undefined}
          onClick={requestAutopilotMode}
        />
      </div>

      {/* ── Premium Upgrade Modal (Req 2.1) ─────────────────────────────── */}
      <Dialog
        open={premiumModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelUpgrade();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <DialogTitle>{PREMIUM_MODAL_TITLE}</DialogTitle>
            <DialogDescription>{PREMIUM_MODAL_DESCRIPTION}</DialogDescription>
          </DialogHeader>

          <ul className="mt-2 space-y-2" aria-label="Premium benefits">
            {PREMIUM_MODAL_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelUpgrade}
            >
              {PREMIUM_MODAL_SECONDARY}
            </Button>
            <Button type="button" onClick={handleUpgradeClick}>
              {PREMIUM_MODAL_PRIMARY}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AutoPilot Confirmation Dialog (Req 3.1) ─────────────────────── */}
      <Dialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelEnableAutopilot();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{CONFIRM_DIALOG_TITLE}</DialogTitle>
            <DialogDescription>{CONFIRM_DIALOG_DESCRIPTION}</DialogDescription>
          </DialogHeader>

          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{CONFIRM_DIALOG_WARNING}</span>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEnableAutopilot}
            >
              {CONFIRM_DIALOG_SECONDARY}
            </Button>
            <Button type="button" onClick={handleConfirmEnableAutopilot}>
              {CONFIRM_DIALOG_PRIMARY}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

// ---------------------------------------------------------------------------
// ModeOption — visual radio card
// ---------------------------------------------------------------------------

interface ModeOptionProps {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  badge?: string;
}

const ModeOption: React.FC<ModeOptionProps> = ({
  label,
  description,
  selected,
  disabled,
  onClick,
  badge,
}) => {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:bg-accent/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {badge}
            </span>
          )}
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40",
            )}
            aria-hidden="true"
          >
            {selected ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3 opacity-0" />
            )}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
};

export default PublishingControls;
