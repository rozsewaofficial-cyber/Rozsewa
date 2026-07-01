import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, MapPin, Calendar, Clock, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TopNav from "@/modules/user/components/TopNav";
import API from "@/lib/api";

const LeadRequirementForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("category");
  const categoryName = searchParams.get("name") || "Service Request";

  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Attempt to request geolocation coordinates on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordinates([pos.coords.longitude, pos.coords.latitude]);
          toast({ title: "Location synced", description: "Your coordinates have been auto-filled." });
        },
        (err) => {
          console.warn("Location permission denied", err);
          setCoordinates([77.209, 28.613]); // Delhi default
        }
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (desc.trim().length < 15) {
      toast({ title: "Incomplete description", description: "Please explain your requirements in at least 15 characters.", variant: "destructive" });
      return;
    }
    if (!date || !time) {
      toast({ title: "Missing schedule", description: "Please select a preferred date and time.", variant: "destructive" });
      return;
    }
    if (!coordinates) {
      toast({ title: "Location required", description: "We need your coordinates to search for nearby providers.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await API.post("/leads", {
        categoryId,
        serviceName: categoryName,
        requirementDescription: desc,
        preferredDate: date,
        preferredTime: time,
        coordinates,
        address,
        images: []
      });
      setSubmitted(true);
      toast({ title: "Request Posted!", description: "Requirement broadcasted to nearby partners." });
    } catch (err) {
      toast({ title: "Submission Failed", description: err.response?.data?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        <TopNav title="Intake Submitted" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-500/5">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Broadcasting Lead...</h2>
            <p className="text-sm text-slate-500 font-medium">Your request for <strong>{categoryName}</strong> has been created. Nearby service partners are being matched based on geofence rules.</p>
          </div>
          <button 
            onClick={() => navigate("/")}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-lg shadow-blue-600/10 transition-all active:scale-95"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-8">
      {/* Top Header */}
      <div className="px-4 py-5 border-b border-slate-100 bg-white/85 backdrop-blur-md sticky top-0 z-50 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-slate-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Lead Model Intake</h2>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">{categoryName} Requirements</h1>
        </div>
      </div>

      <div className="flex-grow flex flex-col p-6 max-w-xl mx-auto w-full space-y-6 text-left">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Explain requirements */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Explain What You Need</label>
            <textarea
              required
              rows={5}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 transition-all resize-none placeholder-slate-400"
              placeholder="Tell our partners exactly what needs to be done. For example: Need a deep cleaning for a 3BHK flat including balcony cleaning. Prefer organic materials..."
            />
            <p className="text-[10px] text-slate-400 font-bold text-right">{desc.length} / 15 characters min</p>
          </div>

          {/* Date & Time slots side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={(() => {
                    const today = new Date();
                    const offset = today.getTimezoneOffset();
                    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
                    return localToday.toISOString().split("T")[0];
                  })()}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 transition-all opacity-0 absolute inset-0 cursor-pointer"
                  style={{ zIndex: 2 }}
                />
                <div className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 flex items-center gap-2 pointer-events-none">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className={date ? 'text-slate-900' : 'text-slate-400'}>
                    {date
                      ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'DD/MM/YYYY'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</label>
              <div className="relative">
                <select
                  required
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 transition-all opacity-0 absolute inset-0 cursor-pointer"
                  style={{ zIndex: 2 }}
                >
                  <option value="" disabled>Select Time Slot</option>
                  {(() => {
                    const slots = [];
                    for (let hour = 6; hour <= 23; hour++) {
                      const period = hour >= 12 ? "PM" : "AM";
                      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                      slots.push(`${displayHour.toString().padStart(2, '0')}:00 ${period}`);
                      slots.push(`${displayHour.toString().padStart(2, '0')}:30 ${period}`);
                    }
                    return slots.map(slot => (
                      <option key={slot} value={slot} className="bg-white text-slate-900">
                        {slot}
                      </option>
                    ));
                  })()}
                </select>
                <div className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 flex items-center justify-between gap-2 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className={time ? 'text-slate-900' : 'text-slate-400'}>
                      {time || 'Select Time Slot'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[10px]">▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address Details */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Address details</label>
            <input
              type="text"
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 transition-all placeholder-slate-400"
              placeholder="e.g. Flat 302, Green Valley Apartments, New Delhi"
            />
          </div>

          {/* GPS Coordinates lock strip */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 flex items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-xs font-black text-slate-800 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-600" /> GPS Coordinates Lock</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Required for nearby provider distance calculations.</p>
            </div>
            {coordinates ? (
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">Locked</span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">Syncing...</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-750 text-white font-black uppercase tracking-widest text-[11px] rounded-full shadow-lg shadow-blue-600/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? "Posting..." : (
              <>
                <Send className="h-4 w-4" /> Broadcast Lead Request
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default LeadRequirementForm;
