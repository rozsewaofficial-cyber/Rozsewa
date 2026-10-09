import { useEffect, useState } from "react";
import API from "@/lib/api";

// Rows from before payments carried a status were all completed gifts.
const STATUS = {
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  failed: { label: "Failed", cls: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

/**
 * The giver's latest Welfare Fund contributions with their status, from the
 * existing /welfare-fund/my-contributions. `refreshKey` changes after a gift.
 */
const WelfareContributionHistory = ({ refreshKey = 0, limit = 5 }) => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get("/welfare-fund/my-contributions", { params: { limit } })
      .then(({ data }) => { if (!cancelled) setRows(data.contributions || []); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [refreshKey, limit]);

  if (!rows || rows.length === 0) return null;
  return (
    <div className="space-y-1.5" data-welfare-history>
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Your contributions</p>
      {rows.map((c) => {
        const st = STATUS[c.status] || STATUS.paid;
        return (
          <div key={c._id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2" data-welfare-row={c.status || "paid"}>
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">₹{Number(c.amount).toLocaleString("en-IN")}</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {" · "}
                {c.bookingId ? "With a booking" : c.paymentMethod === "razorpay" ? "UPI / Card" : "Wallet"}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${st.cls}`}>{st.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default WelfareContributionHistory;
