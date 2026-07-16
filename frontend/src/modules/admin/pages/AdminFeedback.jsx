import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Star, MessageSquare, Filter, Reply, CheckCircle2, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminFeedback = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    setTitle("Review & Feedback");
    fetchReviews();
  }, [setTitle]);

  const fetchReviews = async () => {
    try {
      const { data } = await API.get("/admin/feedback");
      setReviews(data);
    } catch (err) {
      toast({ title: "Sync Failed", description: "Could not load real reviews.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (id) => {
    setReviews(reviews.map(r => r.id === id ? { ...r, acknowledged: true } : r));
    toast({ title: "Feedback Acknowledged", description: "The review has been marked as reviewed." });
  };

  const filteredReviews = reviews.filter(r => {
    const author = r?.author || "";
    const comment = r?.comment || "";
    const search = (searchTerm || "").toLowerCase();

    const matchesSearch = author.toLowerCase().includes(search) ||
      comment.toLowerCase().includes(search);
    const matchesFilter = filter === "all" ||
      (filter === "positive" && r.rating >= 4) ||
      (filter === "negative" && r.rating <= 3) ||
      (filter === "unacknowledged" && !r.acknowledged);
    const matchesRole = roleFilter === "all" || r.role === roleFilter;

    return matchesSearch && matchesFilter && matchesRole;
  });

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Syncing Feedback Ledger...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Feedback Moderation</h2>
          <p className="mt-1 text-sm text-gray-500">Monitor and respond to platform reviews.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:min-w-[280px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="Search comments or users..." />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-200 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-600">Filters:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-8 text-xs font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:bg-white transition-colors cursor-pointer appearance-none">
              <option value="all">All Ratings</option>
              <option value="positive">Positive (4-5 ⭐)</option>
              <option value="negative">Negative (1-3 ⭐)</option>
              <option value="unacknowledged">Action Needed</option>
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-8 text-xs font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:bg-white transition-colors cursor-pointer appearance-none">
              <option value="all">All Sources</option>
              <option value="user">From Users</option>
              <option value="provider">From Providers</option>
            </select>
          </div>
        </div>
        {(filter !== "all" || roleFilter !== "all" || searchTerm !== "") && (
          <button 
            onClick={() => {
              setSearchTerm("");
              setFilter("all");
              setRoleFilter("all");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-all active:scale-95 shadow-sm"
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredReviews.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500 font-medium tracking-tight">No voice of customer found yet.</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <motion.div key={review.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm ${review.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {review.author.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
                      {review.author}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${review.role === 'user' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {review.role}
                      </span>
                    </h3>
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-500 mt-0.5">
                      {review.date} • towards <span className="text-gray-900 underline decoration-gray-300 underline-offset-2">{review.provider || review.user}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 rounded-lg px-2 py-1 border border-amber-100">
                  <span className="text-sm font-extrabold text-amber-600">{review.rating}</span>
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                </div>
              </div>
              <div className="relative rounded-xl bg-gray-50/50 p-4 border border-gray-100 text-sm text-gray-700 text-left">
                {review.comment}
                <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1">
                  {review.tags?.map(tag => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <button className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                  <Reply className="h-3.5 w-3.5" /> Reply
                </button>
                <button
                  onClick={() => !review.acknowledged && handleAcknowledge(review.id)}
                  disabled={review.acknowledged}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${review.acknowledged
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed border border-transparent'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-sm'
                    }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {review.acknowledged ? 'Reviewed' : 'Acknowledge'}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminFeedback;
