import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, TrendingUp, ThumbsUp, ThumbsDown, Filter, Loader2, Send, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const ProviderReviews = () => {
  const navigate = useNavigate();
  const [filterRating, setFilterRating] = useState(0); // 0 = all
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();

  const handleReplySubmit = async (reviewId) => {
    if (!replyText.trim()) return;
    try {
      await API.post(`/bookings/${reviewId}/reply`, { reply: replyText });
      toast({ title: "Reply submitted successfully!" });
      setReviews(reviews.map(r => r._id === reviewId ? { ...r, reply: replyText, replyDate: new Date() } : r));
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      toast({ title: "Failed to submit reply", variant: "destructive" });
    }
  };

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data } = await API.get("/bookings/provider/reviews");
        setReviews(data);
      } catch (err) {
        console.error("Failed to fetch reviews", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, total: 0, dist: [0, 0, 0, 0, 0], positive: 0 };
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    reviews.forEach(r => { sum += r.rating; dist[r.rating - 1]++; });
    return {
      avg: (sum / reviews.length).toFixed(1),
      total: reviews.length,
      dist,
      positive: Math.round(((dist[3] + dist[4]) / reviews.length) * 100),
    };
  }, [reviews]);

  const filtered = filterRating > 0 ? reviews.filter(r => r.rating === filterRating) : reviews;

  const suggestions = useMemo(() => {
    const tips = [];
    if (stats.avg < 4) tips.push("Focus on completing jobs on time to improve ratings.");
    if (stats.dist[0] + stats.dist[1] > 0) tips.push("Address low-rated reviews to prevent pattern of complaints.");
    if (reviews.length < 10) tips.push("Complete more bookings to build your review profile.");
    if (stats.positive < 80) tips.push("Maintain professional behaviour to increase positive reviews.");
    if (tips.length === 0) tips.push("Great job! Keep up the excellent service quality. 🌟");
    return tips;
  }, [stats, reviews]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <ProviderTopNav />
      {loading ? (
        <div className="flex h-96 items-center justify-center p-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <main className="container max-w-2xl px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/provider')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Reviews & Feedback</h1>
          </div>

          {/* Stats Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Big Rating */}
              <div className="text-center">
                <div className="text-5xl font-black text-foreground">{stats.avg}</div>
                <div className="flex gap-1 mt-1 justify-center">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`h-4 w-4 ${s <= Math.round(stats.avg) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase text-muted-foreground mt-2 tracking-widest">{stats.total} reviews</p>
              </div>

              {/* Distribution */}
              <div className="flex-1 w-full space-y-1.5">
                {[5, 4, 3, 2, 1].map(n => {
                  const count = stats.dist[n - 1];
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground w-4">{n}</span>
                      <Star className="h-3 w-3 text-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${n >= 4 ? "bg-emerald-500" : n === 3 ? "bg-amber-500" : "bg-rose-500"}`} />
                      </div>
                      <span className="text-[10px] font-black text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Score */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                <ThumbsUp className="h-5 w-5 text-emerald-600 mx-auto" />
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">{stats.positive}%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Positive</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <TrendingUp className="h-5 w-5 text-blue-600 mx-auto" />
                <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-1">{stats.avg >= 4.5 ? "A+" : stats.avg >= 4 ? "A" : stats.avg >= 3 ? "B" : "C"}</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">Performance</p>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">💡 Tips for you</h3>
            {suggestions.map((s, i) => (
              <p key={i} className="text-[11px] font-medium text-foreground/80">• {s}</p>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {[0, 5, 4, 3, 2, 1].map(n => (
              <button key={n} onClick={() => setFilterRating(n)}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filterRating === n ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-border"
                  }`}>
                {n === 0 ? "All" : `${n} Star`}
              </button>
            ))}
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">No reviews found</p>
              </div>
            ) : filtered.map((r, i) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 overflow-hidden">
                      {r.profileImage ? (
                        <img src={r.profileImage} alt={r.user} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-primary">{(r.user || "U").substring(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">{r.user}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{r.service}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                </div>
                {r.review && (
                  <div className="mt-3 relative">
                    <p className="text-xs font-medium text-foreground/80 leading-relaxed italic">"{r.review}"</p>
                  </div>
                )}
                {r.reply ? (
                  <div className="mt-3 rounded-xl bg-muted p-3 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Your Reply</p>
                    <p className="text-xs font-medium text-foreground/80">{r.reply}</p>
                    <p className="text-[9px] font-bold text-muted-foreground mt-1">
                      {new Date(r.replyDate || new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ) : replyingTo === r._id ? (
                  <div className="mt-3 space-y-2">
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      className="w-full rounded-xl bg-muted p-3 text-xs font-medium border border-border outline-none focus:border-primary/50 resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setReplyingTo(null)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                      <button onClick={() => handleReplySubmit(r._id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 transition-colors">
                        <Send className="h-3 w-3" /> Submit
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReplyingTo(r._id); setReplyText(""); }} className="mt-2 text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Reply to Review
                  </button>
                )}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded uppercase">Verified</span>
                </div>
              </motion.div>
            ))}
          </div>
        </main>
      )}
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderReviews;
