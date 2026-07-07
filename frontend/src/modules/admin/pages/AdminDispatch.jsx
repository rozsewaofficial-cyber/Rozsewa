import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Zap, Clock, ArrowRight, User, MapPin, Loader2 } from "lucide-react";
import API from "@/lib/api";

const AdminDispatch = () => {
  const { setTitle } = useOutletContext();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTitle("Job Dispatching");
    fetchJobs();
  }, [setTitle]);

  const fetchJobs = async () => {
    try {
      // Get pending bookings for the dispatch queue
      const { data } = await API.get("/admin/bookings?status=pending");
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch dispatch queue", err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date) => {
    const diff = Math.floor((new Date() - new Date(date)) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Job Dispatch Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor real-time job requests and assign to nearest providers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1"><Clock className="h-4 w-4" /> Live Queue</h3>

          {loading ? (
            <div className="flex h-32 items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mr-2" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Live Jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-400 font-bold text-sm tracking-tight">No pending jobs in queue.</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job._id} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900">{job.serviceName}</h4>
                      <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded uppercase tracking-tighter">ID: {job._id?.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {job.userId?.name || 'Customer'}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.address}</span>
                      <span className="flex items-center gap-1 text-emerald-600"><Clock className="h-3 w-3" /> {getTimeAgo(job.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/bookings', { state: { searchId: job._id } })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-md active:scale-95 transition-all"
                >
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-card p-6 h-fit shadow-sm text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-4">
            <MapPin className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-gray-900">Map Dispatch Disabled</h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Enable Google Maps API to view provider clusters and live traffic for manual routing and geo-dispatching.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDispatch;
