//
// The workspace's credit balance, read once per workspace and shared by every surface.
//
// **Why a provider and not a per-page hook.** The balance is a property of the workspace,
// not of a prospect — and four surfaces need it: the prospect page and the queue to price
// their controls, Eva to price Enrich Now, and the learning dashboard to show the ledger. A
// hook that fetched per page would add a request to each of them, and the dossier's request
// budget — Property 6, in `pages/__tests__/ProspectDossier.compose.test.tsx` — is explicit
// about how many reads a selection is allowed to cost. That pin exists for a good reason:
// page load cost is a product property, and a workspace-level number has no business being
// paid for per prospect.
//
// So the read happens once, above the routes, and pages consume it. `useCredits()` outside
// the provider is not an error — it answers "unread", every price tag renders nothing, and
// the page works. A balance is chrome, and chrome must not be able to break a page.
//
// It deliberately does **not** poll. The balance only changes when this operator spends
// something — the backend has no other writer — so the honest refresh trigger is the action
// that spent it. `refresh()` is what the paid routes call, and only when the response says
// something was actually charged.
//
// `balance` is `null` until the first read lands, and `null` is not zero. Zero is the
// server's answer for a workspace nobody has granted anything to; null is "we have not
// asked". A screen showing 0 for the second would tell an operator with credits that they
// had none, which is why `CreditBalanceBadge` renders nothing for null.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { createElement } from "react";
import gtmAPI, { type CreditBalance, type CreditReason } from "@/services/gtmAPI";
import { priceOf } from "@/components/gtm/CreditBalance";

export interface CreditsState {
  /** The whole payload — balance, prices, history — or `null` before the first read. */
  credits: CreditBalance | null;
  /** Just the number, or `null` before the first read. Never a stand-in zero. */
  balance: number | null;
  loading: boolean;
  /** The read's own failure. Never surfaced into a page's error slot. */
  error: string | null;
  /** Re-read after a paid action. Returns the fresh payload, or null if the read failed. */
  refresh: () => Promise<CreditBalance | null>;
  /** What the server says `reason` costs, or `null` when the price list is unread. */
  priceFor: (reason: CreditReason) => number | null;
}

/**
 * The answer outside a provider: nothing is known and nothing breaks.
 *
 * Every consumer is written to treat `null` as "do not claim a price", so a page rendered
 * outside the provider — a test, a route that is not workspace-scoped — shows no tags and
 * no badge rather than throwing.
 */
const UNREAD: CreditsState = {
  credits: null,
  balance: null,
  loading: false,
  error: null,
  refresh: async () => null,
  priceFor: () => null,
};

const CreditsContext = createContext<CreditsState>(UNREAD);

/**
 * The workspace id from the path, or `undefined` when this route is not workspace-scoped.
 *
 * Every space-scoped route in `App.tsx` is `/<segment>/:spaceId`, and `spaceId` is the
 * brand id the whole GTM layer keys on. The UUID guard is what keeps `/spaces`, `/auth` and
 * the legal pages from firing a read that would 422 — and it is the same guard `evaAPI`
 * applies before it will talk to a real backend.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function brandIdFromPath(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[1];
  return candidate && UUID.test(candidate) ? candidate : undefined;
}

export interface CreditsProviderProps {
  children: ReactNode;
  /** Overrides the path-derived id. For tests and for any non-routed embedding. */
  brandId?: string;
  historyLimit?: number;
}

export function CreditsProvider({
  children,
  brandId: override,
  historyLimit = 20,
}: CreditsProviderProps) {
  const { pathname } = useLocation();
  const brandId = override ?? brandIdFromPath(pathname);

  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards an out-of-order response from overwriting a newer one — the same `reqRef` device
  // the GTM pages use. A refresh fired right after a charge can easily land before an
  // in-flight initial read, and the older answer would show the pre-charge balance.
  const reqRef = useRef(0);

  const read = useCallback(async (): Promise<CreditBalance | null> => {
    if (!brandId) return null;
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const next = await gtmAPI.getCredits(brandId, { historyLimit });
      if (seq !== reqRef.current) return next;
      setCredits(next);
      setError(null);
      return next;
    } catch (err) {
      if (seq === reqRef.current) {
        setError(err instanceof Error ? err.message : "Could not read the credit balance");
        // The previous payload is deliberately kept. A balance that was right a moment ago
        // is more useful than none, and this error is never rendered as a page failure —
        // "stale-but-labelled beats empty", the rule the queue page follows.
      }
      return null;
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [brandId, historyLimit]);

  // Re-reads when the workspace changes and not when the page does: `read` depends on
  // `brandId`, so moving between two surfaces of one workspace costs nothing.
  useEffect(() => {
    void read();
  }, [read]);

  const value = useMemo<CreditsState>(
    () => ({
      credits,
      balance: credits ? credits.balance : null,
      loading,
      error,
      refresh: read,
      priceFor: (reason: CreditReason) => priceOf(credits, reason),
    }),
    [credits, error, loading, read]
  );

  return createElement(CreditsContext.Provider, { value }, children);
}

/** The shared balance. Answers "unread" outside a provider rather than throwing. */
export function useCredits(): CreditsState {
  return useContext(CreditsContext);
}

export default useCredits;
