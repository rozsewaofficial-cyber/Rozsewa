import { useEffect, useRef } from "react";
import { toast } from "sonner";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { clearPendingReferral, getDeviceId, getPendingReferral } from "@/lib/referral";

// Answers that mean the code can never apply to this account, so it is
// dropped instead of being retried on every visit.
const FINAL_STATUSES = new Set([400, 403, 404]);

/**
 * Applies the code from a friend's invite link once the customer is signed
 * in. Signing up never carried the code (no signup method accepted one), so
 * invited friends were never linked to whoever invited them and the
 * inviter never earned.
 */
const ReferralAutoApply = () => {
  const { isAuthenticated, role, user } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || role !== "customer" || inFlight.current) return;
    const code = getPendingReferral();
    if (!code) return;

    inFlight.current = true;
    (async () => {
      try {
        const { data } = await API.post("/coins/referral/apply", { code, deviceId: getDeviceId() });
        clearPendingReferral();
        toast.success(data?.message || "Referral code applied.");
      } catch (err) {
        const status = err.response?.status;
        if (FINAL_STATUSES.has(status)) {
          clearPendingReferral();
          const message = err.response?.data?.message;
          // Already referred / own code / not a customer: nothing to tell them.
          if (status === 404 || /first completed order/i.test(message || "")) {
            toast.error(message || "That referral code could not be applied.");
          }
        }
        // Network or server trouble: keep the code and try on the next visit.
      } finally {
        inFlight.current = false;
      }
    })();
  }, [isAuthenticated, role, user?._id, user?.id]);

  return null;
};

export default ReferralAutoApply;
