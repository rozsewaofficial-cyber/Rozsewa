import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Clock,
  ShieldCheck, AlertTriangle, Loader2, Video, Eye, Camera
} from "lucide-react";
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
  draft: { icon: Clock, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20", label: "Draft" },
  pending: { icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", label: "Pending Review" },
  verified: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20", label: "Approved" },
  rejected: { icon: XCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20", label: "Rejected" },
};

const getScriptText = (lang, name, date, code) => {
  if (lang === 'hi') {
    return `मेरा नाम ${name} है। आज की तारीख ${date} है। मेरा वेरिफिकेशन कोड ${code} है। मैं पुष्टि करता हूँ कि मैं अपनी स्वेच्छा से रोज़सेवा केवाईसी वेरिफिकेशन पूरा कर रहा हूँ और जमा किए गए सभी दस्तावेज़ मेरे हैं।`;
  }
  return `My name is ${name}. Today is ${date}. My verification code is ${code}. I confirm that I am completing my Rozsewa KYC verification voluntarily and that all the documents submitted belong to me.`;
};

const ProviderDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [uploading, setUploading] = useState(null); // ID of document being uploaded

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const stopRecordingRef = useRef(null);

  const [activeDocType, setActiveDocType] = useState(null);
  const [previewVideoModal, setPreviewVideoModal] = useState(null);

  // Video Recorder State
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recordingState, setRecordingState] = useState("idle"); // idle, permissions, ready, recording, review, uploading
  const [stream, setStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [scriptLang, setScriptLang] = useState("en"); // en, hi
  const [recordedMetadata, setRecordedMetadata] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoBlob, setVideoBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
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

  // Video verification trigger
  const startRecordingFlow = async () => {
    if (attempts >= 5) {
      toast({
        title: "Attempts Limit Reached",
        description: "You have used all 5 recording attempts. Please submit your application or refresh to try again.",
        variant: "destructive"
      });
      return;
    }

    setRecorderOpen(true);
    setRecordingState("permissions");
    setErrorMsg("");

    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      });

      setStream(userStream);

      // Validate stream tracks
      const audioTracks = userStream.getAudioTracks();
      const videoTracks = userStream.getVideoTracks();

      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        setErrorMsg("Microphone track not found or disabled. Please verify your microphone connection.");
        userStream.getTracks().forEach(t => t.stop());
        return;
      }
      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        setErrorMsg("Camera feed is inactive or camera is frozen. Please check camera connections.");
        userStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Generate Code & Dates
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      const today = new Date();
      const dateEn = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const dateHi = today.toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      setRecordedMetadata({
        name: provider?.ownerName || 'Rozsewa Partner',
        dateEn,
        dateHi,
        code
      });

      // Default Script: English
      const scriptText = getScriptText('en', provider?.ownerName || 'Rozsewa Partner', dateEn, code);
      setGeneratedScript(scriptText);
      setScriptLang('en');
      setRecordingState("ready");

      // Attach stream to preview video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
        }
      }, 100);

    } catch (err) {
      console.error(err);
      setErrorMsg("Camera or microphone permission was denied. Please allow camera and mic access to proceed.");
    }
  };

  const handleLangChange = (lang) => {
    if (!recordedMetadata) return;
    setScriptLang(lang);
    const dateText = lang === 'hi' ? recordedMetadata.dateHi : recordedMetadata.dateEn;
    const scriptText = getScriptText(lang, recordedMetadata.name, dateText, recordedMetadata.code);
    setGeneratedScript(scriptText);
  };

  const startRecording = () => {
    if (!stream) return;

    setAttempts(prev => prev + 1);
    const chunks = [];
    const options = { mimeType: 'video/webm;codecs=vp9' };
    let recorder;

    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setVideoBlob(blob);
      setVideoPreviewUrl(URL.createObjectURL(blob));
      setRecordingState("review");
    };

    setRecordedChunks(chunks);
    setMediaRecorder(recorder);
    setRecordingSeconds(0);
    setRecordingState("recording");
    recorder.start();
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [mediaRecorder, stream]);

  // Recording Timer
  useEffect(() => {
    let interval;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 30) {
            clearInterval(interval);
            stopRecordingRef.current?.();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  const retakeRecording = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl("");
    setVideoBlob(null);
    setRecordedChunks([]);
    startRecordingFlow();
  };

  const closeRecordingFlow = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setStream(null);
    setMediaRecorder(null);
    setVideoBlob(null);
    setVideoPreviewUrl("");
    setRecorderOpen(false);
    setRecordingState("idle");
  };

  const uploadRecording = async () => {
    if (!videoBlob) return;
    setRecordingState("uploading");

    const formData = new FormData();
    formData.append("video", videoBlob, "live_video.webm");
    formData.append("verificationScript", generatedScript);
    formData.append("verificationCode", generatedCode);
    formData.append("scriptVersion", scriptLang === 'hi' ? "v1_hi" : "v1");

    try {
      const { data } = await API.post("/provider/live-video", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      // Update local state
      const updatedDocs = [...(provider.documents || [])];
      const index = updatedDocs.findIndex(d => d.id === 'live_video');
      if (index > -1) {
        updatedDocs[index] = data.document;
      } else {
        updatedDocs.push(data.document);
      }

      setProvider({ ...provider, documents: updatedDocs });
      toast({ title: "Live Video Uploaded", description: "Verification video saved successfully." });
      closeRecordingFlow();
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: err.response?.data?.message || "Could not save verification video.",
        variant: "destructive"
      });
      setRecordingState("review");
    }
  };

  const handleSubmitKyc = async () => {
    setLoading(true);
    try {
      await API.post("/provider/submit-kyc");
      toast({ title: "KYC Submitted Successfully", description: "Verification team will review your application shortly." });
      fetchProfile();
      navigate("/provider");
    } catch (err) {
      toast({
        title: "Submission Failed",
        description: err.response?.data?.message || "Could not submit identity.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const verifiedCount = provider?.documents?.filter(d => d.status === "verified").length || 0;

  // Validation Rules
  const aadhaarDoc = getDocStatus('aadhaar');
  const panDoc = getDocStatus('pan');
  const liveVideoDoc = getDocStatus('live_video');

  const canSubmit =
    aadhaarDoc && aadhaarDoc.status !== 'rejected' &&
    panDoc && panDoc.status !== 'rejected' &&
    liveVideoDoc && liveVideoDoc.status !== 'rejected' &&
    (aadhaarDoc.status === 'draft' || panDoc.status === 'draft' || liveVideoDoc.status === 'draft' || provider?.kycStatus === 'rejected');

  const getMissingValidationErrors = () => {
    const errors = [];
    if (!aadhaarDoc) errors.push("Aadhaar Card is missing");
    else if (aadhaarDoc.status === 'rejected') errors.push("Aadhaar Card needs re-upload");

    if (!panDoc) errors.push("PAN Card is missing");
    else if (panDoc.status === 'rejected') errors.push("PAN Card needs re-upload");

    if (!liveVideoDoc) errors.push("Live Video is not recorded");
    else if (liveVideoDoc.status === 'rejected') errors.push("Live Video needs re-recording");

    return errors;
  };

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
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{verifiedCount}/{docTypes.length + 1} items verified</p>
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
              <p className="text-xs text-white/80 font-medium">
                {provider?.kycVerified ? "Fully Verified Provider" : `KYC Status: ${provider?.kycStatus?.toUpperCase()?.replace('_', ' ') || 'DRAFT'}`}
              </p>
              <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(verifiedCount / (docTypes.length + 1)) * 100}%` }}
                  className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" transition={{ duration: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Live Video Verification Card */}
        {provider?.providerCategory === 'sewak' && (
          <div className="rounded-[24px] border border-border bg-card p-5 space-y-4 text-left shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${liveVideoDoc?.status === 'verified'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                    : liveVideoDoc
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  <Video className="h-6 w-6" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5 leading-none mb-1.5">
                    <h3 className="text-sm font-black text-foreground truncate uppercase tracking-tight">Live Video Verification</h3>
                    <span className="text-[8px] font-black text-rose-500 uppercase bg-rose-50 px-1 py-0.5 rounded">Required</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${!liveVideoDoc ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' :
                      liveVideoDoc.status === 'draft' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' :
                        liveVideoDoc.status === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' :
                          liveVideoDoc.status === 'verified' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                            'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                    }`}>
                    {!liveVideoDoc ? 'Not Recorded' :
                      liveVideoDoc.status === 'draft' ? 'Uploaded (Draft)' :
                        liveVideoDoc.status === 'pending' ? 'Pending Review' :
                          liveVideoDoc.status === 'verified' ? 'Approved' : 'Rejected'}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {liveVideoDoc && (
                  <button
                    onClick={() => setPreviewVideoModal(liveVideoDoc.url)}
                    className="flex items-center justify-center h-9 w-9 rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-colors shadow-sm"
                    title="View Recording"
                  >
                    <Eye className="h-4.5 w-4.5" />
                  </button>
                )}
                {(!liveVideoDoc || liveVideoDoc.status === 'draft' || liveVideoDoc.status === 'rejected') ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={startRecordingFlow}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm bg-primary text-white hover:bg-emerald-700"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {liveVideoDoc?.status === 'rejected' ? 'Retake Video' : liveVideoDoc ? 'Retake Video' : 'Start Verification'}
                  </motion.button>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <CheckCircle2 className={`h-4 w-4 ${liveVideoDoc.status === 'verified' ? 'text-emerald-500' : 'text-amber-500 opacity-40'}`} />
                  </div>
                )}
              </div>
            </div>
            {liveVideoDoc?.status === 'rejected' && liveVideoDoc.rejectionReason && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 p-3 rounded-xl text-xs font-medium text-rose-700">
                <p className="font-bold text-rose-800 mb-0.5">Live Video Rejected</p>
                <p className="text-[11px] text-rose-600 leading-relaxed">Reason: {liveVideoDoc.rejectionReason}</p>
              </div>
            )}
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-3">
          {docTypes.map((doc, i) => {
            const uploaded = getDocStatus(doc.id);
            const StatusIcon = uploaded ? statusConfig[uploaded.status]?.icon || Clock : null;
            const isUploading = uploading === doc.id;
            const isVerified = uploaded?.status === "verified";

            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-[24px] border border-border bg-card p-4 transition-all ${isVerified ? 'border-emerald-500/10' : ''}`}>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isVerified ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-muted text-muted-foreground'}`}>
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5 leading-none mb-1.5">
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
                      ) : !isVerified ? (
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUploadClick(doc.id)}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${uploaded?.status === 'rejected' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-primary text-white hover:bg-emerald-700'}`}>
                          <Upload className="h-3.5 w-3.5" /> {uploaded?.status === 'rejected' ? 'Re-upload' : 'Upload'}
                        </motion.button>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  {uploaded?.status === 'rejected' && uploaded?.rejectionReason && (
                    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 p-3 rounded-xl text-xs font-medium text-rose-700 text-left">
                      <p className="font-bold text-rose-800 mb-0.5">Document Rejected</p>
                      <p className="text-[11px] text-rose-600 leading-relaxed">Reason: {uploaded.rejectionReason}</p>
                    </div>
                  )}
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

        {/* Validation Errors Box */}
        {provider?.providerCategory === 'sewak' && getMissingValidationErrors().length > 0 && provider?.kycSubmitted && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2 text-rose-800 text-xs font-black uppercase tracking-wider">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
              <span>Missing/Rejected Requirements</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] text-rose-700 font-medium space-y-1">
              {getMissingValidationErrors().map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button for Sewaks */}
        {provider?.providerCategory === 'sewak' && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitKyc}
              disabled={!canSubmit}
              className={`w-full h-16 rounded-[24px] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${canSubmit
                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700'
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

      {/* In-App Recording Interface Modal */}
      <AnimatePresence>
        {recorderOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-6 overflow-y-auto">
            {/* Header Summary Row */}
            <div className="w-full flex justify-between items-center max-w-lg">
              <div className="text-left">
                <h3 className="text-white text-lg font-black tracking-tight">Live Video Verification</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Attempt {attempts} of 5</p>
              </div>
              {recordingState !== 'recording' && recordingState !== 'uploading' && (
                <button
                  onClick={closeRecordingFlow}
                  className="h-10 w-10 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-colors shadow"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Language Selector Selector */}
            {recordingState === 'ready' && (
              <div className="w-full max-w-lg flex gap-2 justify-start items-center border-b border-slate-900 pb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-2">Script Language:</span>
                <button
                  onClick={() => handleLangChange('en')}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${scriptLang === 'en'
                      ? 'bg-primary text-white border-primary shadow-md shadow-emerald-950/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                >
                  English
                </button>
                <button
                  onClick={() => handleLangChange('hi')}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${scriptLang === 'hi'
                      ? 'bg-primary text-white border-primary shadow-md shadow-emerald-950/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                >
                  हिंदी (Hindi)
                </button>
              </div>
            )}

            {/* Camera/Preview Area */}
            <div className="w-full max-w-lg aspect-[4/3] rounded-[32px] bg-slate-900 overflow-hidden relative border border-slate-800 shadow-2xl flex items-center justify-center">
              {recordingState === 'permissions' && (
                <div className="text-center p-6 space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-bold text-slate-300">Requesting camera & microphone permissions...</p>
                </div>
              )}

              {errorMsg && (
                <div className="text-center p-6 space-y-3 text-rose-500">
                  <AlertTriangle className="h-10 w-10 mx-auto" />
                  <p className="text-sm font-black leading-relaxed">{errorMsg}</p>
                  <button
                    onClick={startRecordingFlow}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs uppercase shadow-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {(recordingState === 'ready' || recordingState === 'recording') && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {recordingState === 'review' && (
                <video
                  src={videoPreviewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}

              {/* Timer Overlay */}
              {recordingState === 'recording' && (
                <div className="absolute top-4 right-4 bg-rose-600/90 text-white font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-rose-500/30 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  <span>00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}</span>
                </div>
              )}
            </div>

            {/* Script Area */}
            {generatedScript && (
              <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[28px] p-5 space-y-3 text-left">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Verification Script (Read Out Loud)</span>
                  <span className="text-primary font-mono">Code: {generatedCode}</span>
                </div>
                <p className="text-slate-200 text-sm font-black leading-relaxed font-serif italic">
                  "{generatedScript}"
                </p>
              </div>
            )}

            {/* Control Actions */}
            <div className="w-full max-w-lg flex flex-col gap-4">
              {recordingState === 'ready' && (
                <button
                  onClick={startRecording}
                  className="w-full h-16 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20 active:scale-[0.99] transition-all"
                >
                  <span className="h-3 w-3 rounded-full bg-white mr-1 animate-pulse" />
                  Start Recording
                </button>
              )}

              {recordingState === 'recording' && (
                <button
                  onClick={stopRecording}
                  disabled={recordingSeconds < 15}
                  className={`w-full h-16 text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all ${recordingSeconds >= 15
                      ? 'bg-slate-800 hover:bg-slate-700 shadow-xl shadow-slate-900/45 cursor-pointer'
                      : 'bg-slate-900/50 text-slate-500 cursor-not-allowed border border-slate-800'
                    }`}
                >
                  {recordingSeconds < 15 ? (
                    <span>Record at least 15s (Wait {15 - recordingSeconds}s)</span>
                  ) : (
                    <>
                      <span className="h-3 w-3 bg-white rounded-none" />
                      Stop Recording
                    </>
                  )}
                </button>
              )}

              {recordingState === 'review' && (
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={retakeRecording}
                    className="h-16 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
                  >
                    Retake Recording
                  </button>
                  <button
                    onClick={uploadRecording}
                    className="h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/25 transition-all"
                  >
                    Upload Video
                  </button>
                </div>
              )}

              {recordingState === 'uploading' && (
                <div className="w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 text-left">
                  <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-wider">Uploading verification video...</p>
                    <p className="text-[10px] text-slate-400 font-medium">Please do not close this window or refresh.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideoModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setPreviewVideoModal(null)} />
            <div className="relative w-full max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="text-left">
                  <h3 className="text-lg font-black text-slate-900">Live Verification Video</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">KYC Live Record</p>
                </div>
                <button onClick={() => setPreviewVideoModal(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 bg-slate-50 flex items-center justify-center">
                <video src={previewVideoModal} controls autoPlay className="w-full max-h-[50vh] rounded-2xl shadow-lg border border-slate-200" />
              </div>
              <div className="p-6 text-center bg-white">
                <button
                  onClick={() => setPreviewVideoModal(null)}
                  className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest h-12"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProviderDocuments;
