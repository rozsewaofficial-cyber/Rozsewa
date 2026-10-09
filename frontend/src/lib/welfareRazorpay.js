import API from "@/lib/api";

/** Razorpay's checkout script, loaded once on demand. */
export const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/**
 * A Welfare Fund gift by UPI / card, for customers and partners alike.
 *
 * The server makes the order (and records the gift as pending at the amount
 * it fixed); the gift counts only once the server has verified the payment.
 * A closed checkout is recorded as cancelled, a refused payment as failed.
 *
 * Resolves with { status: 'paid' | 'pending' | 'cancelled' | 'failed', message }
 * — 'pending' when Razorpay took the payment but our server could not confirm
 * it yet (it is checked with Razorpay the next time the history loads).
 * Rejects only when the payment could not be started at all.
 */
export const payWelfareByRazorpay = async ({ amount, user }) => {
  const ok = await loadRazorpay();
  if (!ok) throw new Error("Payment SDK failed to load");
  const { data: order } = await API.post("/welfare-fund/order", { amount });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    const close = (outcome, reason) =>
      API.post("/welfare-fund/close", { razorpay_order_id: order.id, outcome, reason }).catch(() => {});

    const checkout = new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
      amount: order.amount,
      currency: order.currency,
      name: "RozSewa Welfare Fund",
      description: "Anna Seva & Jeev Seva contribution",
      order_id: order.id,
      handler: async (response) => {
        try {
          const { data } = await API.post("/welfare-fund/verify", response);
          finish({ status: "paid", message: data?.message || `Your ₹${order.amount / 100} contribution has been received.` });
        } catch (err) {
          // Paid at Razorpay but not confirmed here: it stays pending for a
          // re-check rather than being counted or called failed.
          finish({ status: "pending", message: "We could not confirm this payment yet. If money was taken, it will show as Paid shortly — please don't pay again." });
        }
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          close("cancelled");
          finish({ status: "cancelled", message: "Payment cancelled — nothing was taken." });
        }
      },
      prefill: { name: user?.name || user?.ownerName, email: user?.email, contact: user?.mobile },
      theme: { color: "#059669" }
    });
    // A refused attempt: recorded as failed. Razorpay keeps its window open
    // for another try, which (if it succeeds) is still verified and counted.
    checkout.on("payment.failed", (resp) => {
      close("failed", resp?.error?.description);
    });
    checkout.open();
  });
};
