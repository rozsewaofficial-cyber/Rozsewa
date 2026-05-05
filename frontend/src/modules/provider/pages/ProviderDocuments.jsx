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
  { id: "license", label: "Business License", required: false },
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
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeDocType) return;

    setUploading(activeDocType);
    const formData = new FormData();
    formData.append("document", file);
    formData.append("docId", activeDocType);

    try {
      const { data } = await API.post("/provider/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" }
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
      toast({ title: "Upload Successful", description: `${activeDocType} sent for verification.` });
    } catch (err) {
      toast({ title: "Upload Failed", description: "Could not send document.", variant: "destructive" });
    } finally {
      setUploading(null);
      setActiveDocType(null);
      e.target.value = null;
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

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

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
                        <p className="text-[10px] text-muted-foreground font-bold opacity-60 uppercase tracking-widest leading-none">Not uploaded</p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isUploading ? (
                      <div className="p-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : (uploaded?.status !== "verified" && uploaded?.status !== "pending") ? (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUploadClick(doc.id)}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${uploaded?.status === 'rejected' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-primary text-white hover:bg-emerald-700'}`}>
                        <Upload className="h-3.5 w-3.5" /> {uploaded?.status === 'rejected' ? 'Re-upload' : 'Upload'}
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
