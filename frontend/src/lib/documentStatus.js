// A partner's document verification status, worked out from the documents
// on their profile (each one draft / pending / verified / rejected). Admin's
// badges and the partner's Home page both read it from here, so the two can
// never disagree.

export const DOCUMENT_LABELS = {
  aadhaar: "Aadhaar",
  aadhaar_front: "Aadhaar (front)",
  aadhaar_back: "Aadhaar (back)",
  pan: "PAN Card",
  gst: "GST Certificate",
  license: "Driving License",
  certification: "Skill Certification",
  police: "Police Verification",
  live_video: "Live Video",
  shop_photo: "Shop Photo",
  profile_photo: "Profile Photo",
};

export const documentLabel = (id) =>
  DOCUMENT_LABELS[id] || String(id || "Document").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Admin's one-line summary: No documents / Rejected / Verified / In progress n/m / Pending. */
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

/**
 * What the partner needs to know, most urgent first:
 *   none     – nothing uploaded yet
 *   rejected – one or more rejected: re-upload required
 *   draft    – uploaded but not yet submitted for review
 *   review   – submitted, waiting for admin
 *   verified – every document verified
 */
export const partnerDocumentStatus = (provider) => {
  const docs = provider?.documents || [];
  const total = docs.length;
  const verified = docs.filter((d) => d.status === "verified").length;
  const rejected = docs
    .filter((d) => d.status === "rejected")
    .map((d) => ({ id: d.id, label: documentLabel(d.id), reason: d.rejectionReason || "" }));
  const drafts = docs.filter((d) => d.status === "draft").length;

  let state = "verified";
  if (total === 0) state = "none";
  else if (rejected.length > 0) state = "rejected";
  else if (drafts > 0) state = "draft";
  else if (verified < total) state = "review";

  return { state, total, verified, rejected };
};
