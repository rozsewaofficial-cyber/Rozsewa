import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Clock, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const docTypes = [
  { id: "aadhaar", label: "Aadhaar Card", required: true },
  { id: "pan", label: "PAN Card", required: true },
  { id: "gst", label: "GST Certificate", required: false },
  { id: "license", label: "Driving License", required: false },
  { id: "certification", label: "Skill Certification", required: false },
  { id: "police", label: "Police Verification", required: false },
];

const statusConfig = {
  pending: { icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", label: "Pending" },
  verified: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20", label: "Verified" },
  rejected: { icon: XCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20", label: "Rejected" },
};

const ProviderDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [uploading, setUploading] = useState(null); // ID of document being uploaded

  const fileInputRef = useRef(null);
  const [activeDocType, setActiveDocType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docNumberInput, setDocNumberInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [aadhaarSessionId, setAadhaarSessionId] = useState("");
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [dobInput, setDobInput] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      setProvider(data);
    } catch (err) {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (docId) => {
    setActiveDocType(docId);
    if (docId === 'aadhaar') {
        setDocNumberInput(provider?.kycAadhaar || "");
        setIsVerified(provider?.kycAadhaar ? true : false);
    } else if (docId === 'pan') {
        setDocNumberInput(provider?.kycPanNumber || "");
        setIsVerified(provider?.kycPanNumber ? true : false);
    } else if (docId === 'gst') {
        setDocNumberInput(provider?.gst || "");
        setIsVerified(provider?.gst ? true : false);
    } else {
        setDocNumberInput("");
        setIsVerified(true);
    }
    setOtpSent(false);
    setAadhaarSessionId("");
    setAadhaarOtp("");
    setIsModalOpen(true);
  };

  const handleVerifyPAN = async () => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(docNumberInput)) {
      return toast({ title: "Invalid PAN", description: "Please enter a valid PAN format.", variant: "destructive" });
    }
    setIsVerifying(true);
    try {
      const { data } = await API.post("/verify/pan", { pan: docNumberInput });
      if (data.status === "VERIFIED" || data.success) {
        setIsVerified(true);
        toast({ title: "PAN Verified" });
      } else {
        toast({ title: "Verification Failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyGST = async () => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    if (!gstRegex.test(docNumberInput)) {
      return toast({ title: "Invalid GST", description: "Please enter a valid GST format.", variant: "destructive" });
    }
    setIsVerifying(true);
    try {
      const { data } = await API.post("/verify/gst", { gstNumber: docNumberInput });
      if (data?.status === "VERIFIED" || data?.success) {
        setIsVerified(true);
        toast({ title: "GST Verified" });
      } else {
        toast({ title: "Verification Failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCriminal = async () => {
    if (!docNumberInput) {
      return toast({ title: "Invalid ID", description: "Please enter your ID number.", variant: "destructive" });
    }
    setIsVerifying(true);
    try {
      const payload = {
        idNumber: docNumberInput,
        name: provider?.ownerName || provider?.shopName || "Unknown",
        address: provider?.address || "Unknown"
      };
      const { data } = await API.post("/verify/criminal_verification", payload);
      if (data?.status === "SUCCESS" || data?.success) {
        setIsVerified(true);
        toast({ title: "Criminal Record Verified", description: data.message || "Verification completed." });
      } else {
        toast({ title: "Verification Failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyDrivingLicence = async () => {
    if (!docNumberInput || !dobInput) {
      return toast({ title: "Invalid Input", description: "Please enter your driving license number and Date of Birth.", variant: "destructive" });
    }
    setIsVerifying(true);
    try {
      const payload = {
        licence_number: docNumberInput,
        dob: dobInput
      };
      const { data } = await API.post("/verify/driving_licence", payload);
      if (data?.status === "SUCCESS" || data?.success) {
        setIsVerified(true);
        toast({ title: "Driving License Verified", description: "Verification completed successfully." });
      } else {
        toast({ title: "Verification Failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleInitiateOKYC = async () => {
    if (!docNumberInput || docNumberInput.length !== 12) {
      return toast({ title: "Invalid Aadhaar", description: "Must be 12 digits.", variant: "destructive" });
    }
    setIsVerifying(true);
    try {
      const { data } = await API.post("/verify/okyc/initiate", { aadhaarNumber: docNumberInput });
      if (data.success || data.status === "OTP_SENT") {
        const sid = data.data?.sessionId || data.sessionId;
        if (sid) {
           setAadhaarSessionId(sid);
           setOtpSent(true);
           toast({ title: "OTP Sent" });
        }
      } else {
        toast({ title: "Failed", description: data.message || "Failed to initiate Aadhaar OKYC.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOKYC = async () => {
    if (!aadhaarOtp || aadhaarOtp.length < 6) return toast({ title: "Invalid OTP", variant: "destructive" });
    setIsVerifying(true);
    try {
      const { data } = await API.post("/verify/okyc/verify", { 
        sessionId: aadhaarSessionId,
        otp: aadhaarOtp,
        aadhaarNumber: docNumberInput
      });
      if (data.success || data.status === "VERIFIED") {
        setIsVerified(true);
        toast({ title: "Aadhaar Verified" });
      } else {
        toast({ title: "Failed", description: data.message || "Failed to verify Aadhaar OTP.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitDocument = async () => {
    if (!activeDocType || !docNumberInput) return;

    setUploading(activeDocType);
    setIsModalOpen(false);
    
    try {
      const { data } = await API.post("/provider/documents", {
        docId: activeDocType,
        docNumber: docNumberInput
      });

      // Update local state
      const updatedDocs = [...(provider.documents || [])];
      const index = updatedDocs.findIndex(d => d.id === activeDocType);
      if (index > -1) {
        updatedDocs[index] = data.document;
      } else {
        updatedDocs.push(data.document);
      }

      setProvider({ ...provider, documents: updatedDocs });
      toast({ title: "Details Saved", description: `${docTypes.find(d => d.id === activeDocType)?.label} details verified and saved successfully.` });
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Could not save document details.";
      toast({ title: "Save Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setUploading(null);
      setActiveDocType(null);
      setDocNumberInput("");
    }
  };

  const getDocStatus = (docId) => {
    return provider?.documents?.find(d => d.id === docId);
  };

  const verifiedCount = provider?.documents?.filter(d => d.status === "verified").length || 0;
  const totalDocs = provider?.documents?.length || 0;

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <ProviderTopNav />

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Submit Document</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Please enter your document ID number below. Real-time verification may be required.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                    {activeDocType === 'license' ? 'Driving License Number' : 'Document Number'}
                  </label>
                  <input
                    type="text"
                    value={docNumberInput}
                    onChange={(e) => { setDocNumberInput(e.target.value); setIsVerified(false); }}
                    placeholder="e.g. 123456789012"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  
                  {activeDocType === 'license' && (
                    <div className="mt-4">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Date of Birth</label>
                      <input
                        type="date"
                        value={dobInput}
                        onChange={(e) => { setDobInput(e.target.value); setIsVerified(false); }}
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {activeDocType === 'pan' && !isVerified && (
                      <button onClick={handleVerifyPAN} disabled={isVerifying || !docNumberInput} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-100 text-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-200 disabled:opacity-50">
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {isVerifying ? "Verifying..." : "Verify PAN API"}
                      </button>
                  )}
                  {activeDocType === 'gst' && !isVerified && (
                      <button onClick={handleVerifyGST} disabled={isVerifying || !docNumberInput} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-100 text-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-200 disabled:opacity-50">
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {isVerifying ? "Verifying..." : "Verify GST API"}
                      </button>
                  )}
                  {activeDocType === 'police' && !isVerified && (
                      <button onClick={handleVerifyCriminal} disabled={isVerifying || !docNumberInput} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-100 text-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-200 disabled:opacity-50">
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {isVerifying ? "Verifying..." : "Verify Criminal Record"}
                      </button>
                  )}
                  {activeDocType === 'license' && !isVerified && (
                      <button onClick={handleVerifyDrivingLicence} disabled={isVerifying || !docNumberInput || !dobInput} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-100 text-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-200 disabled:opacity-50">
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {isVerifying ? "Verifying..." : "Verify Driving License"}
                      </button>
                  )}
                  {activeDocType === 'aadhaar' && !isVerified && !otpSent && (
                      <button onClick={handleInitiateOKYC} disabled={isVerifying || !docNumberInput} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-100 text-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-200 disabled:opacity-50">
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {isVerifying ? "Sending..." : "Send Aadhaar OTP"}
                      </button>
                  )}
                  {activeDocType === 'aadhaar' && !isVerified && otpSent && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 border-t border-border pt-4">
                          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Aadhaar OTP</label>
                          <input type="text" value={aadhaarOtp} onChange={(e) => setAadhaarOtp(e.target.value)} placeholder="6-digit OTP" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium mb-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                          <button onClick={handleVerifyOKYC} disabled={isVerifying || !aadhaarOtp} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50">
                              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {isVerifying ? "Verifying..." : "Verify OTP"}
                          </button>
                      </motion.div>
                  )}
                  {isVerified && (
                      <div className="mt-3 text-[10px] bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl font-bold uppercase flex items-center justify-center gap-1.5 border border-emerald-100">
                          <CheckCircle2 className="h-4 w-4" /> API Verification Complete
                      </div>
                  )}
                </div>
                
                <button
                  onClick={handleSubmitDocument}
                  disabled={!docNumberInput || (['aadhaar', 'pan', 'gst', 'police', 'license'].includes(activeDocType) && !isVerified)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="h-4 w-4" /> Save Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0 shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="text-left">
            <h1 className="text-xl font-black text-foreground tracking-tight">KYC Verification</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{verifiedCount}/{docTypes.length} documents verified</p>
          </div>
        </div>

        {/* Progress Card */}
        <div className="rounded-[32px] bg-emerald-600 dark:bg-emerald-900/40 p-6 text-white shadow-xl border border-emerald-500/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 h-32 w-32 -mr-10 -mt-10 rounded-full bg-white/10 blur-2xl"></div>
          <div className="relative z-10 flex items-center gap-5">
            <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md border border-white/20">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-extrabold text-lg">Identity Score</h3>
              <p className="text-xs text-white/80 font-medium">{verifiedCount === docTypes.length ? "Fully Verified Provider" : "Verification in progress..."}</p>
              <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(verifiedCount / docTypes.length) * 100}%` }}
                  className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" transition={{ duration: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-3">
          {docTypes.map((doc, i) => {
            const uploaded = getDocStatus(doc.id);
            const StatusIcon = uploaded ? statusConfig[uploaded.status]?.icon || Clock : null;
            const isUploading = uploading === doc.id;

            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-[24px] border border-border bg-card p-4 transition-all ${uploaded?.status === 'verified' ? 'border-emerald-500/10' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${uploaded?.status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-1.5 leading-none mb-1">
                        <h3 className="text-sm font-black text-foreground truncate uppercase tracking-tight">{doc.label}</h3>
                        {doc.required && <span className="text-[8px] font-black text-rose-500 uppercase bg-rose-50 px-1 py-0.5 rounded">Required</span>}
                      </div>
                      {uploaded ? (
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusConfig[uploaded.status]?.color} border border-transparent`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig[uploaded.status]?.label}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground font-bold opacity-60 uppercase tracking-widest leading-none">Not provided</p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isUploading ? (
                      <div className="p-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : (uploaded?.status !== "verified" && uploaded?.status !== "pending") ? (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUploadClick(doc.id)}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${uploaded?.status === 'rejected' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-primary text-white hover:bg-emerald-700'}`}>
                        <ShieldCheck className="h-3.5 w-3.5" /> {uploaded?.status === 'rejected' ? 'Re-verify' : 'Verify'}
                      </motion.button>
                    ) : (uploaded?.status === "pending" || uploaded?.status === "verified") ? (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <CheckCircle2 className={`h-4 w-4 ${uploaded.status === 'verified' ? 'text-emerald-500' : 'text-amber-500 opacity-40'}`} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Important Protection</p>
            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">All data is encrypted. Required documents must be verified before payouts are enabled. Verification usually takes 24-48 business hours.</p>
          </div>
        </div>

        {/* Submit Button for Sewaks */}
        {provider?.providerCategory === 'sewak' && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                toast({ title: "Identity Submitted", description: "Verification team will review your docs shortly." });
                navigate("/provider");
              }}
              disabled={!getDocStatus('aadhaar') || !getDocStatus('pan')}
              className={`w-full h-16 rounded-[24px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${(getDocStatus('aadhaar') && getDocStatus('pan'))
                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20'
                  : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Finish & Submit Identity</span>
            </motion.button>
            <p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-[0.2em] mt-4 px-10 leading-relaxed">
              By submitting, you agree that the information provided is accurate and belongs to you.
            </p>
          </div>
        )}
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderDocuments;
