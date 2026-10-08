// Partner verification is two steps, and the admin panel used to show only
// the second: a partner read "Verified" / "Pending" with nothing about the
// documents. These badges show both, so an approval can never look done
// while a document is still waiting.

export const documentVerification = (provider) => {
  const docs = provider?.documents || [];
  if (docs.length === 0) return { key: "none", label: "No documents", tone: "bg-gray-100 text-gray-500" };
  if (docs.some((d) => d.status === "rejected")) return { key: "rejected", label: "Rejected", tone: "bg-red-50 text-red-600" };
  if (docs.every((d) => d.status === "verified")) return { key: "verified", label: "Verified", tone: "bg-emerald-50 text-emerald-700" };
  const done = docs.filter((d) => d.status === "verified").length;
  return {
    key: "pending",
    label: done > 0 ? `In progress ${done}/${docs.length}` : "Pending",
    tone: "bg-amber-50 text-amber-700",
  };
};

export const partnerApproval = (provider) => {
  switch (provider?.status) {
    case "verified": return { label: "Approved", tone: "bg-emerald-50 text-emerald-700" };
    case "rejected": return { label: "Rejected", tone: "bg-red-50 text-red-600" };
    case "suspended": return { label: "Suspended", tone: "bg-red-50 text-red-600" };
    default: return { label: "Pending", tone: "bg-amber-50 text-amber-700" };
  }
};

/** Whether admin can approve this partner now: every document verified. */
export const canApprove = (provider) => documentVerification(provider).key === "verified";

const Badge = ({ title, tone, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
    <span className="text-gray-400">{title}</span>
    <span className={`rounded-md px-2 py-0.5 ${tone}`}>{label}</span>
  </span>
);

const VerificationStatus = ({ provider, className = "" }) => {
  const docs = documentVerification(provider);
  const approval = partnerApproval(provider);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Badge title="Documents" tone={docs.tone} label={docs.label} />
      <Badge title="Approval" tone={approval.tone} label={approval.label} />
    </div>
  );
};

export default VerificationStatus;
