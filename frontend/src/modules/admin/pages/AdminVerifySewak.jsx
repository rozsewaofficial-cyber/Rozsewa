import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useScrollLock } from "@/lib/scrollLock";
import { 
  CheckCircle, XCircle, Search, FileText, Loader2, MapPin, Phone, Eye, 
  Video, Calendar, Shield, Clock, AlertCircle, Play, Download, ShieldCheck,
  ChevronDown, ChevronUp, CheckCircle2, RotateCw, ZoomIn, ZoomOut, Maximize2,
  ChevronLeft, ChevronRight, RefreshCw, Layers
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import API from "@/lib/api";

const statusColors = {
  draft: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  pending: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  rejected: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
};

const docTypes = [
  { id: "aadhaar", label: "Aadhaar Card", required: true },
  { id: "pan", label: "PAN Card", required: true },
  { id: "gst", label: "GST Certificate", required: false },
  { id: "license", label: "Business License", required: false },
  { id: "certification", label: "Skill Certification", required: false },
  { id: "police", label: "Police Verification", required: false },
];

const AdminVerifySewak = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const paramSewakId = searchParams.get("sewakId");
  const paramDocId = searchParams.get("docId");
  
  // Data States
  const [sewaks, setSewaks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection States
  const [selectedSewakId, setSelectedSewakId] = useState(null);
  const [activeReviewItemId, setActiveReviewItemId] = useState("live_video");
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Interaction Controls (Image Preview)
  const [zoomScale, setZoomScale] = useState(1);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Collapsible on tablet/mobile

  // Rejection Dialog State
  const [rejectionTarget, setRejectionTarget] = useState(null); // { sewakId, docId }
  const [rejectionReason, setRejectionReason] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useScrollLock(!!rejectionTarget || isFullscreenPreview);

  useEffect(() => {
    setTitle("Verify Sewak KYC");
    fetchPendingSewaks();
  }, [setTitle]);

  const fetchPendingSewaks = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/sewaks/pending-kyc");
      setSewaks(data);
      if (data.length > 0) {
        setSelectedSewakId(data[0]._id);
      }
    } catch (err) {
      toast({ title: "Fetch Failed", description: "Failed to retrieve pending Sewaks.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Sync / load deep-linked Sewak from query params
  useEffect(() => {
    const checkAndFetchSewak = async () => {
      if (!paramSewakId || loading) return;
      
      const exists = sewaks.some(s => s._id === paramSewakId);
      if (exists) {
        setSelectedSewakId(paramSewakId);
        return;
      }
      
      try {
        const { data } = await API.get(`/admin/sewaks/${paramSewakId}`);
        if (data) {
          setSewaks(prev => {
            if (prev.some(s => s._id === data._id)) return prev;
            return [data, ...prev];
          });
          setSelectedSewakId(data._id);
        }
      } catch (err) {
        toast({ title: "Fetch Failed", description: "Could not retrieve the selected Sewak.", variant: "destructive" });
      }
    };

    checkAndFetchSewak();
  }, [paramSewakId, sewaks, loading]);

  // Sync active checklist item from query params
  useEffect(() => {
    if (paramDocId) {
      setActiveReviewItemId(paramDocId);
    }
  }, [paramDocId]);

  // Helper: Get identity score (Aadhaar: 35%, PAN: 35%, Live Video: 30%)
  const getIdentityScore = (sewak) => {
    if (!sewak || !sewak.documents) return 0;
    let score = 0;
    const aadhaar = sewak.documents.find(d => d.id === 'aadhaar');
    const pan = sewak.documents.find(d => d.id === 'pan');
    const liveVideo = sewak.documents.find(d => d.id === 'live_video');

    if (aadhaar?.status === 'verified') score += 35;
    if (pan?.status === 'verified') score += 35;
    if (liveVideo?.status === 'verified') score += 30;

    // Optional document verification boost (+5 points each, max score 100)
    const optionals = sewak.documents.filter(d => 
      ['gst', 'license', 'certification', 'police'].includes(d.id) && d.status === 'verified'
    );
    if (optionals.length > 0) {
      score = Math.min(100, score + optionals.length * 5);
    }

    return score;
  };

  // Helper: Get completion percentage of KYC review (docs reviewed / docs uploaded)
  const getCompletionPercentage = (sewak) => {
    if (!sewak || !sewak.documents || sewak.documents.length === 0) return 0;
    const uploadedDocs = sewak.documents;
    const reviewedDocs = uploadedDocs.filter(d => d.status === 'verified' || d.status === 'rejected');
    return Math.round((reviewedDocs.length / uploadedDocs.length) * 100);
  };

  // Helper: Retrieve progress status counters
  const getKycSummary = (sewak) => {
    if (!sewak || !sewak.documents) return { completed: 0, total: 0, approved: 0, pending: 0, rejected: 0 };
    const docs = sewak.documents;
    const total = docs.length;
    const approved = docs.filter(d => d.status === 'verified').length;
    const rejected = docs.filter(d => d.status === 'rejected').length;
    const pending = docs.filter(d => d.status === 'pending').length;
    const completed = approved + rejected;
    return { completed, total, approved, pending, rejected };
  };

  // Helper: Standardize documents & video mapping
  const getChecklistItems = (sewak) => {
    if (!sewak) return [];
    const items = [
      { id: 'live_video', label: 'Live Video Verification', required: true },
      { id: 'aadhaar', label: 'Aadhaar Card', required: true },
      { id: 'pan', label: 'PAN Card', required: true },
      { id: 'gst', label: 'GST Certificate', required: false },
      { id: 'license', label: 'Business License', required: false },
      { id: 'certification', label: 'Skill Certification', required: false },
      { id: 'police', label: 'Police Verification', required: false },
    ];

    return items.map(item => {
      const doc = sewak.documents?.find(d => d.id === item.id);
      return {
        ...item,
        uploaded: !!doc,
        status: doc ? doc.status : 'not_uploaded',
        url: doc?.url,
        fileName: doc?.fileName,
        uploadedAt: doc?.uploadedAt,
        bytes: doc?.bytes,
        format: doc?.format || (doc?.url ? doc.url.split('.').pop().split('?')[0] : null),
        rejectionReason: doc?.rejectionReason,
        duration: doc?.duration,
        verificationCode: doc?.verificationCode,
        verificationScript: doc?.verificationScript,
        scriptVersion: doc?.scriptVersion,
      };
    });
  };

  // Client Side Filtering & Sorting
  const filteredSewaks = sewaks.filter(s => {
    if (s._id === selectedSewakId) return true;

    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      s.ownerName?.toLowerCase().includes(query) ||
      s.vendorCode?.toLowerCase().includes(query) ||
      s.mobile?.toLowerCase().includes(query) ||
      s.city?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') {
      return s.kycStatus === 'submitted' || s.kycStatus === 'under_review' || s.kycStatus === 'draft' || !s.kycStatus;
    }
    if (filterStatus === 'partially_approved') {
      return s.kycStatus === 'partially_approved';
    }
    if (filterStatus === 'rejected') {
      return s.kycStatus === 'rejected';
    }
    return true;
  });

  const sortedSewaks = [...filteredSewaks].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    }
    if (sortBy === "oldest") {
      return new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0);
    }
    if (sortBy === "score_desc") {
      return getIdentityScore(b) - getIdentityScore(a);
    }
    if (sortBy === "score_asc") {
      return getIdentityScore(a) - getIdentityScore(b);
    }
    return 0;
  });

  // Sync selected sewak when list changes
  useEffect(() => {
    if (sortedSewaks.length > 0) {
      const exists = sortedSewaks.some(s => s._id === selectedSewakId);
      if (!selectedSewakId || !exists) {
        setSelectedSewakId(sortedSewaks[0]._id);
      }
    } else {
      setSelectedSewakId(null);
    }
  }, [searchTerm, filterStatus, sortBy, sewaks]);

  // Selected Sewak Object Reference
  const activeSewak = sewaks.find(s => s._id === selectedSewakId);

  // Active Review Item Object Reference
  const activeChecklist = getChecklistItems(activeSewak);
  const activeReviewItem = activeChecklist.find(c => c.id === activeReviewItemId);

  // Keyboard Shortcuts Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events when the user is typing in forms/textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevItem();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReviewItemId, selectedSewakId, sewaks]);

  const handlePrevItem = () => {
    if (!activeSewak) return;
    const checklist = getChecklistItems(activeSewak);
    const index = checklist.findIndex(c => c.id === activeReviewItemId);
    if (index > 0) {
      setActiveReviewItemId(checklist[index - 1].id);
      handleResetView();
    }
  };

  const handleNextItem = () => {
    if (!activeSewak) return;
    const checklist = getChecklistItems(activeSewak);
    const index = checklist.findIndex(c => c.id === activeReviewItemId);
    if (index >= 0 && index < checklist.length - 1) {
      setActiveReviewItemId(checklist[index + 1].id);
      handleResetView();
    }
  };

  // Image Toolbar Handlers
  const handleZoomIn = () => setZoomScale(prev => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoomScale(prev => Math.max(1, prev - 0.25));
  const handleRotateCw = () => setRotationAngle(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setZoomScale(1);
    setRotationAngle(0);
  };

  // API Workflows: Approve and Reject single items
  const handleItemStatusChange = async (sewakId, docId, status, reason = "") => {
    try {
      const { data } = await API.put(`/admin/sewaks/${sewakId}/documents/${docId}/status`, {
        status,
        rejectionReason: reason
      });

      // Update locally — upsert the document entry so it works even for sewaks with no prior uploads
      setSewaks(prev => prev.map(s => {
        if (s._id === sewakId) {
          const existingDocs = s.documents || [];
          const docExists = existingDocs.some(d => d.id === docId);

          const updatedDocs = docExists
            ? existingDocs.map(d =>
                d.id === docId ? { ...d, status, rejectionReason: reason || null } : d
              )
            : [...existingDocs, { id: docId, status, rejectionReason: reason || null }];

          if (data.kycStatus === 'verified') {
            return null; // Filters verified sewak out of pending list
          }

          return { ...s, documents: updatedDocs, kycStatus: data.kycStatus, status: data.providerStatus };
        }
        return s;
      }).filter(Boolean));

      toast({ 
        title: `${docId.toUpperCase().replace('_', ' ')} ${status === 'verified' ? 'Approved' : 'Rejected'}`, 
        description: `Status updated successfully.` 
      });

      setRejectionTarget(null);
      setRejectionReason("");
    } catch (err) {
      toast({ title: "Update Failed", description: err.response?.data?.message || "Could not update status.", variant: "destructive" });
    }
  };


  const openRejectionDialog = (sewakId, docId) => {
    setRejectionTarget({ sewakId, docId });
    setRejectionReason("");
  };

  const submitRejection = () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection Reason Required", description: "Please state why this item is being rejected.", variant: "destructive" });
      return;
    }
    handleItemStatusChange(rejectionTarget.sewakId, rejectionTarget.docId, 'rejected', rejectionReason);
  };

  // API Bulk Workflows
  const handleVerifyGlobal = async (id) => {
    setBulkProcessing(true);
    try {
      await API.put(`/admin/sewaks/${id}/verify`);
      setSewaks(prev => prev.filter(s => s._id !== id));
      toast({ title: "Sewak Approved Successfully", description: "KYC verified and account activated." });
    } catch (err) {
      toast({ title: "Global Verification Failed", variant: "destructive" });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleRejectGlobal = async (id) => {
    setBulkProcessing(true);
    try {
      await API.put(`/admin/sewaks/${id}/reject`, { rejectionReason: "KYC documents rejected globally by admin." });
      setSewaks(prev => prev.filter(s => s._id !== id));
      toast({ title: "Sewak KYC Rejected Globally", description: "All documents marked as rejected." });
    } catch (err) {
      console.error("Global reject error:", err.response ? err.response.data : err);
      toast({ title: "Global Action Failed", variant: "destructive" });
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk Download Trigger
  const handleDownloadAllDocs = (sewak) => {
    if (!sewak || !sewak.documents || sewak.documents.length === 0) {
      toast({ title: "No documents to download", variant: "destructive" });
      return;
    }
    toast({ title: "Downloading batch documents...", description: "Downloading files sequentially. Please allow downloads in your browser." });
    
    sewak.documents.forEach((doc, index) => {
      if (!doc.url) return;
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = doc.url;
        link.target = "_blank";
        link.download = `${sewak.vendorCode}_${doc.id}.${doc.format || 'jpg'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 600); // Prevent blocking
    });
  };

  // Loader state
  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Filter and Search Action Header */}
      <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-left w-full md:w-auto">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-blue-600" /> Sewak KYC Workspace
          </h1>
          <p className="text-xs text-gray-500 font-medium">Verify live recordings and documents of Sewaks.</p>
        </div>

        {/* Sorting, Filtering & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:max-w-3xl">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, name, phone, city..."
              className="w-full bg-slate-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Filter: All Statuses</option>
              <option value="pending">Filter: Pending Review</option>
              <option value="partially_approved">Filter: Partially Approved</option>
              <option value="rejected">Filter: Rejected</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="score_desc">Sort: Highest Score</option>
              <option value="score_asc">Sort: Lowest Score</option>
            </select>

            {/* Mobile Sidebar Toggle Button */}
            <Button
              variant="outline"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden border-gray-200 text-gray-500 h-9 px-3"
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      {sortedSewaks.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 max-w-xl mx-auto">
          <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="h-10 w-10 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-gray-900">You're all caught up!</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto px-4">There are currently no Sewak KYC applications awaiting review matching your search filters.</p>
          </div>
          <Button 
            onClick={fetchPendingSewaks}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs px-5 py-2.5 h-10 inline-flex items-center gap-1.5 shadow"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh List
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR PANEL (30%) */}
          <div className={`${isSidebarOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 bg-white border border-gray-100 rounded-[2rem] shadow-sm p-4 space-y-4 max-h-[85vh] overflow-y-auto`}>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Pending applicants ({sortedSewaks.length})
              </span>
              <button 
                onClick={fetchPendingSewaks}
                className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Sync
              </button>
            </div>

            <div className="space-y-3">
              {sortedSewaks.map(sewak => {
                const isSelected = sewak._id === selectedSewakId;
                const score = getIdentityScore(sewak);
                const progress = getCompletionPercentage(sewak);

                return (
                  <div
                    key={sewak._id}
                    onClick={() => {
                      setSelectedSewakId(sewak._id);
                      handleResetView();
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-blue-50/70 border-blue-200 ring-2 ring-blue-500/10' 
                        : 'bg-white border-gray-100 hover:bg-slate-50/50 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-sm font-black ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sewak.profileImage ? (
                          <img
                            src={sewak.profileImage}
                            alt={sewak.ownerName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span
                          className="h-full w-full items-center justify-center text-sm font-black"
                          style={{ display: sewak.profileImage ? 'none' : 'flex' }}
                        >
                          {sewak.ownerName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className="text-xs font-black text-gray-900 truncate leading-none">{sewak.ownerName}</h4>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 leading-none ${statusColors[sewak.kycStatus || 'draft']}`}>
                            {sewak.kycStatus || 'draft'}
                          </span>
                        </div>
                        <p className="text-[9px] font-black text-gray-400 tracking-wider uppercase mb-2">{sewak.vendorCode}</p>
                        
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 truncate">
                            <MapPin className="h-2.5 w-2.5 text-blue-500" /> {sewak.city}
                          </span>
                          <span className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">
                            Score: {score}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress details on card */}
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex items-center justify-between text-[9px] text-gray-400 font-black">
                      <span>Submitted: {sewak.createdAt ? new Date(sewak.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'N/A'}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-emerald-600">KYC: {progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT WORKSPACE PANEL (70%) */}
          {activeSewak ? (
            <div className="lg:col-span-8 bg-white border border-gray-100 rounded-[2rem] shadow-sm p-6 text-left space-y-6 max-h-[85vh] overflow-y-auto">
              
              {/* Workspace Header Progress Panel */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  {/* Profile Avatar */}
                  <div className="h-14 w-14 rounded-2xl shrink-0 overflow-hidden flex items-center justify-center bg-blue-600 text-white text-xl font-black shadow-sm border-2 border-blue-100">
                    {activeSewak.profileImage ? (
                      <img
                        src={activeSewak.profileImage}
                        alt={activeSewak.ownerName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span
                      className="h-full w-full items-center justify-center text-xl font-black"
                      style={{ display: activeSewak.profileImage ? 'none' : 'flex' }}
                    >
                      {activeSewak.ownerName?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 leading-tight">{activeSewak.ownerName}</h2>
                      <span className="text-[9px] font-black font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{activeSewak.vendorCode}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {activeSewak.mobile}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" /> {activeSewak.city}, {activeSewak.state}</span>
                      <span>Submitted: {activeSewak.createdAt ? new Date(activeSewak.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Identity score summary and actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto shrink-0">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm shrink-0">
                    {/* Identity Score Gauge */}
                    <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="#f1f5f9" strokeWidth="3" fill="transparent" />
                        <circle cx="20" cy="20" r="16" stroke="#2563eb" strokeWidth="3" fill="transparent"
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - getIdentityScore(activeSewak) / 100)}
                          strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-[9px] font-black text-slate-800">{getIdentityScore(activeSewak)}%</span>
                    </div>
                    <div className="text-left leading-none">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Identity Score</span>
                      <span className="text-xs font-black text-slate-700">Premium Grade</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleRejectGlobal(activeSewak._id)}
                      disabled={bulkProcessing}
                      variant="outline"
                      className="flex-1 sm:flex-none border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-10 rounded-xl text-xs font-bold"
                    >
                      {bulkProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Global Reject"}
                    </Button>
                    <Button
                      onClick={() => handleVerifyGlobal(activeSewak._id)}
                      disabled={bulkProcessing}
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 rounded-xl shadow-sm text-xs"
                    >
                      {bulkProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve KYC"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Progress Count Summary Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const sum = getKycSummary(activeSewak);
                  return (
                    <>
                      <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 text-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Completed</span>
                        <span className="text-base font-black text-slate-800">{sum.completed} / {sum.total} Items</span>
                      </div>
                      <div className="bg-emerald-50/30 rounded-xl border border-emerald-100/50 p-3 text-center">
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider block mb-0.5">Approved</span>
                        <span className="text-base font-black text-emerald-700">{sum.approved}</span>
                      </div>
                      <div className="bg-amber-50/30 rounded-xl border border-amber-100/50 p-3 text-center">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-0.5">Pending</span>
                        <span className="text-base font-black text-amber-700">{sum.pending}</span>
                      </div>
                      <div className="bg-rose-50/30 rounded-xl border border-rose-100/50 p-3 text-center">
                        <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider block mb-0.5">Rejected</span>
                        <span className="text-base font-black text-rose-700">{sum.rejected}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Workspace Content Split View: Left Checklist (35%) | Right Viewport (65%) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* CHECKLIST INDEX COLUMN (35%) */}
                <div className="md:col-span-4 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">KYC Checklist</h3>
                    <button 
                      onClick={() => handleDownloadAllDocs(activeSewak)}
                      className="text-[10px] font-black text-blue-600 hover:underline uppercase flex items-center gap-1 shrink-0"
                    >
                      <Download className="h-3 w-3" /> Download All
                    </button>
                  </div>
                  
                  <div className="space-y-1.5">
                    {activeChecklist.map(item => {
                      const isActive = item.id === activeReviewItemId;
                      
                      // Status icons configurations
                      let statusIcon = null;
                      if (item.status === 'verified') {
                        statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
                      } else if (item.status === 'rejected') {
                        statusIcon = <XCircle className="h-4 w-4 text-rose-500 shrink-0" />;
                      } else if (item.status === 'pending') {
                        statusIcon = <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
                      } else {
                        statusIcon = <div className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 shrink-0" />;
                      }

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveReviewItemId(item.id);
                            handleResetView();
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                              : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {statusIcon}
                            <span className="truncate leading-none">{item.label}</span>
                            {item.required && (
                              <span className={`text-[8px] font-black uppercase px-1 rounded scale-90 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                              }`}>
                                Req
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                            {item.status === 'not_uploaded' ? 'Empty' : item.status.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Previous / Next Document Swapping Control */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handlePrevItem}
                      disabled={activeChecklist.findIndex(c => c.id === activeReviewItemId) <= 0}
                      className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 h-9 text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleNextItem}
                      disabled={activeChecklist.findIndex(c => c.id === activeReviewItemId) >= activeChecklist.length - 1}
                      className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 h-9 text-xs"
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Use ← and → keys to navigate</span>
                  </div>
                </div>

                {/* PREVIEW WORKSPACE VIEWPORT COLUMN (65%) */}
                <div className="md:col-span-8 flex flex-col min-h-[450px]">
                  
                  {activeReviewItem ? (
                    <div className="border border-slate-200/80 rounded-2xl p-4 md:p-5 bg-white space-y-4 flex flex-col justify-between flex-1">
                      
                      {activeReviewItem.uploaded ? (
                        <>
                          {/* Item Meta Details and Options bar */}
                          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                            <div>
                              <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                {activeReviewItem.id === 'live_video' ? <Video className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-emerald-600" />}
                                {activeReviewItem.label}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Submitted on: {activeReviewItem.uploadedAt ? new Date(activeReviewItem.uploadedAt).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${statusColors[activeReviewItem.status]}`}>
                                {activeReviewItem.status}
                              </span>
                              <a
                                href={activeReviewItem.url}
                                download={`${activeSewak.vendorCode}_${activeReviewItem.id}.${activeReviewItem.format || 'jpg'}`}
                                target="_blank"
                                rel="noreferrer"
                                className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all shadow-sm shrink-0"
                                title="Download File"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </div>

                          {/* Preview Core Area (Conditionally render Video vs Document Image/PDF) */}
                          <div className="flex-1 flex flex-col justify-center min-h-[300px] max-h-[450px]">
                            
                            {activeReviewItem.id === 'live_video' ? (
                              <div className="space-y-4 w-full flex-1 flex flex-col justify-between">
                                {/* HTML5 Video element */}
                                <div className="relative aspect-[4/3] max-h-[320px] rounded-xl overflow-hidden bg-black border border-slate-100 flex-1 mx-auto w-full max-w-[420px]">
                                  <video
                                    src={activeReviewItem.url}
                                    controls
                                    preload="metadata"
                                    className="w-full h-full object-contain"
                                  />
                                </div>

                                {/* Script Match verification information card */}
                                <div className="grid grid-cols-3 gap-2 text-[10px] border-y border-slate-50 py-2.5 font-bold text-slate-500">
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Duration</span>
                                    <span className="text-slate-800">{activeReviewItem.duration || 'N/A'} seconds</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Script Match code</span>
                                    <span className="font-black text-blue-600 font-mono text-xs">{activeReviewItem.verificationCode || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">App Version</span>
                                    <span className="text-slate-800">{activeReviewItem.scriptVersion || 'v1'}</span>
                                  </div>
                                </div>

                                <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 text-xs">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Expected Script Spoken</p>
                                  <p className="font-medium text-slate-700 italic font-serif leading-relaxed">
                                    "{activeReviewItem.verificationScript || 'My name is ... Today is ... My verification code is ...'}"
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col justify-between flex-1">
                                
                                {/* PDF Viewer vs Image Transforms */}
                                {activeReviewItem.format?.toLowerCase() === 'pdf' ? (
                                  <div className="flex-1 w-full border border-slate-100 rounded-xl overflow-hidden bg-slate-50 relative flex items-center justify-center">
                                    <iframe 
                                      src={`${activeReviewItem.url}#toolbar=0&navpanes=0`}
                                      className="w-full h-full min-h-[280px]" 
                                      title={activeReviewItem.label} 
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-1 w-full border border-slate-100 rounded-xl bg-slate-50 relative overflow-hidden flex items-center justify-center min-h-[280px]">
                                    
                                    {/* API Verified — no physical image was uploaded */}
                                    {(!activeReviewItem.url || activeReviewItem.url === 'API_Verified') ? (
                                      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
                                        <div className="h-16 w-16 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center">
                                          <ShieldCheck className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-slate-800">Verified via Government API</p>
                                          <p className="text-[10px] text-slate-400 font-medium mt-1">
                                            This document was verified electronically. No physical image was submitted.
                                          </p>
                                        </div>
                                        {/* Show the stored document number */}
                                        {activeReviewItem.id === 'aadhaar' && activeSewak?.kycAadhaar && (
                                          <div className="bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Aadhaar Number</p>
                                            <p className="text-sm font-black text-slate-800 font-mono tracking-widest">
                                              XXXX XXXX {activeSewak.kycAadhaar.slice(-4)}
                                            </p>
                                          </div>
                                        )}
                                        {activeReviewItem.id === 'pan' && activeSewak?.kycPanNumber && (
                                          <div className="bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">PAN Number</p>
                                            <p className="text-sm font-black text-slate-800 font-mono tracking-widest">
                                              {activeSewak.kycPanNumber}
                                            </p>
                                          </div>
                                        )}
                                        {activeReviewItem.id === 'gst' && activeSewak?.gst && (
                                          <div className="bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">GST Number</p>
                                            <p className="text-sm font-black text-slate-800 font-mono tracking-widest">
                                              {activeSewak.gst}
                                            </p>
                                          </div>
                                        )}
                                        {activeReviewItem.id === 'police' && activeSewak?.kycPoliceVerification && (
                                          <div className="bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Police Verification ID</p>
                                            <p className="text-sm font-black text-slate-800 font-mono tracking-widest">
                                              {activeSewak.kycPoliceVerification}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      /* Image Transforms preview container */
                                      <div className="absolute inset-0 flex items-center justify-center p-4">
                                        <img
                                          src={activeReviewItem.url}
                                          alt={activeReviewItem.label}
                                          style={{ 
                                            transform: `scale(${zoomScale}) rotate(${rotationAngle}deg)`, 
                                            transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                                          }}
                                          className="max-h-full max-w-full object-contain rounded shadow-sm"
                                        />
                                      </div>
                                    )}

                                     {/* Overlay Canvas Viewport Tools bar — only for real images */}
                                    {activeReviewItem.url && activeReviewItem.url !== 'API_Verified' && (
                                     <div className="absolute bottom-3 right-3 bg-white/90 border border-slate-200/80 rounded-xl shadow-lg px-2 py-1 flex items-center gap-1.5 backdrop-blur-sm z-10">
                                       <button onClick={handleZoomIn} className="h-7 w-7 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center transition-colors" title="Zoom In">
                                         <ZoomIn className="h-3.5 w-3.5" />
                                       </button>
                                       <button onClick={handleZoomOut} disabled={zoomScale <= 1} className="h-7 w-7 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center transition-colors disabled:opacity-50" title="Zoom Out">
                                         <ZoomOut className="h-3.5 w-3.5" />
                                       </button>
                                       <button onClick={handleRotateCw} className="h-7 w-7 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center transition-colors" title="Rotate 90°">
                                         <RotateCw className="h-3.5 w-3.5" />
                                       </button>
                                       <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
                                       <button onClick={handleResetView} className="h-7 w-7 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center transition-colors" title="Reset Layout">
                                         <RefreshCw className="h-3 w-3" />
                                       </button>
                                       <button onClick={() => setIsFullscreenPreview(true)} className="h-7 w-7 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center transition-colors" title="View Fullscreen">
                                         <Maximize2 className="h-3.5 w-3.5" />
                                       </button>
                                     </div>
                                    )}
                                  </div>
                                )}

                                {/* File size details */}
                                {activeReviewItem.bytes && (
                                  <p className="text-[9px] text-right font-bold text-slate-400 mt-2 block uppercase">
                                    Format: {activeReviewItem.format?.toUpperCase()} | Size: {Math.round(activeReviewItem.bytes / 1024)} KB
                                  </p>
                                )}
                              </div>
                            )}

                          </div>

                          {/* Review Action Controls Footer */}
                          <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-3">
                            {activeReviewItem.status === 'verified' ? (
                              <div className="w-full py-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-black">
                                <CheckCircle className="h-4 w-4 text-emerald-600 animate-pulse" /> This item has been verified & approved (Read-Only)
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => openRejectionDialog(activeSewak._id, activeReviewItem.id)}
                                    className="flex-1 border-rose-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold h-10 text-xs rounded-xl"
                                  >
                                    <XCircle className="h-4 w-4 mr-1 shrink-0" /> Reject Document
                                  </Button>
                                  <Button
                                    onClick={() => handleItemStatusChange(activeSewak._id, activeReviewItem.id, 'verified')}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 text-xs rounded-xl shadow-sm"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1 shrink-0" /> Approve Document
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Rejection comments display */}
                          {activeReviewItem.status === 'rejected' && activeReviewItem.rejectionReason && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-medium text-rose-700 text-left">
                              <span className="font-black uppercase tracking-wider block text-[8px] text-rose-500 leading-none mb-1">Rejection Reason</span>
                              {activeReviewItem.rejectionReason}
                            </div>
                          )}
                        </>
                      ) : (
                        // Document Not Uploaded Empty State
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                          <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                          <h4 className="text-sm font-black text-slate-800 mb-1">{activeReviewItem.label}</h4>
                          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                            This document has not been uploaded by the Sewak. Click on other checklist items to continue reviews.
                          </p>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 p-10 text-center">
                      <p className="text-slate-400 text-sm font-medium">Select a checklist item from the index to load preview.</p>
                    </div>
                  )}

                </div>
              </div>

            </div>
          ) : (
            <div className="lg:col-span-8 bg-white border border-gray-100 rounded-[2rem] p-16 text-center shadow-sm">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">Synchronizing applicant review space...</p>
            </div>
          )}

        </div>
      )}

      {/* Fullscreen Document Image Modal (Lightbox) */}
      {isFullscreenPreview && activeReviewItem && activeReviewItem.url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setIsFullscreenPreview(false)} />
          <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header info */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0 bg-white">
              <div className="text-left">
                <h3 className="text-base font-black text-slate-900">{activeReviewItem.label}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Fullscreen Identity Document Preview</p>
              </div>
              <button 
                onClick={() => setIsFullscreenPreview(false)} 
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Display Body with full options transforms */}
            <div className="flex-1 bg-slate-950 overflow-hidden relative flex items-center justify-center min-h-[400px]">
              <img 
                src={activeReviewItem.url} 
                alt="Fullscreen KYC Document" 
                style={{ 
                  transform: `scale(${zoomScale}) rotate(${rotationAngle}deg)`, 
                  transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                }}
                className="max-h-[70vh] w-auto max-w-[90vw] object-contain rounded shadow-lg border border-white/5" 
              />
              
              {/* Overlay Float options */}
              <div className="absolute bottom-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl px-3 py-1.5 flex items-center gap-2.5 backdrop-blur-md">
                <button onClick={handleZoomIn} className="h-8 w-8 text-white hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors" title="Zoom In">
                  <ZoomIn className="h-4.5 w-4.5" />
                </button>
                <button onClick={handleZoomOut} disabled={zoomScale <= 1} className="h-8 w-8 text-white hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30" title="Zoom Out">
                  <ZoomOut className="h-4.5 w-4.5" />
                </button>
                <button onClick={handleRotateCw} className="h-8 w-8 text-white hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors" title="Rotate 90°">
                  <RotateCw className="h-4.5 w-4.5" />
                </button>
                <div className="w-[1px] h-5 bg-slate-800 mx-1" />
                <button onClick={handleResetView} className="h-8 w-8 text-white hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors" title="Reset View">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Close footer */}
            <div className="p-4 text-center bg-white border-t border-slate-100 shrink-0">
              <Button onClick={() => setIsFullscreenPreview(false)} className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest h-11">
                Close Fullscreen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Form Dialog Modal */}
      {rejectionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setRejectionTarget(null)} />
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-left space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Reject {rejectionTarget.docId.toUpperCase().replace('_', ' ')}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Please supply a formal reason. The sewak will see this message.</p>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Rejection Comment</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Examples: The name does not match registration details, Aadhaar image card is blurry, verification spoken code does not match."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all h-28 resize-none font-medium text-slate-700"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setRejectionTarget(null)}
                className="h-10 px-4 font-bold border-gray-200 text-gray-500 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={submitRejection}
                className="h-10 px-5 font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm rounded-xl text-xs"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminVerifySewak;
