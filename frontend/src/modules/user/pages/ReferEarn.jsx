import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Share2,
  Copy,
  Users,
  Coins,
  Trophy,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ReferEarn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: referral } = await API.get("/coins/referral");
        setData(referral);
      } catch (err) {
        toast({
          title: "Couldn't load your referral details",
          description: err.response?.data?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    toast({
      title: "Code copied",
      description: "Share it with your friends to start earning coins.",
    });
  };

  const handleShare = async () => {
    if (!data?.referralCode) return;
    const message = `Join me on RozSewa! Use my code ${data.referralCode} when you sign up. ${window.location.origin}`;
    // Native share sheet where the browser supports it, clipboard everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on RozSewa", text: message });
        return;
      } catch (err) {
        // User dismissed the sheet — fall through to the clipboard.
      }
    }
    navigator.clipboard.writeText(message);
    toast({ title: "Invite copied to your clipboard" });
  };

  const handleApplyCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setApplying(true);
    try {
      const { data: result } = await API.post("/coins/referral/apply", {
        code: trimmed,
      });
      toast({ title: "Referral code applied", description: result.message });
      setCode("");
      const { data: referral } = await API.get("/coins/referral");
      setData(referral);
    } catch (err) {
      toast({
        title: "Couldn't apply that code",
        description: err.response?.data?.message || "Please check and try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl space-y-6 px-4 py-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/profile")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-bold text-foreground">Refer & Earn</h1>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">
            Referral details aren't available right now.
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-xl">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 blur-3xl"
              />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="mb-6 rounded-2xl bg-white/20 p-4 backdrop-blur-md">
                  <Gift className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-wider">
                  Earn {data.rewardCoins.toLocaleString("en-IN")} coins per friend
                </h2>
                <p className="mt-2 text-sm font-bold opacity-80">
                  That's ₹{data.rewardValue} of RozSewa Coins. {data.condition}
                </p>
              </div>
            </div>

            {/* Code */}
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Your referral code
              </p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-2xl font-black tracking-tighter text-foreground">
                  {data.referralCode}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCopy}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Copy className="h-5 w-5" />
                </motion.button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleShare}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-xs font-black uppercase tracking-wider text-background"
              >
                <Share2 className="h-4 w-4" />
                Share invite
              </motion.button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <Users className="mx-auto h-5 w-5 text-indigo-500" />
                <p className="mt-2 text-xl font-black tabular-nums text-foreground">
                  {data.totalReferred}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Referred
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <Trophy className="mx-auto h-5 w-5 text-emerald-500" />
                <p className="mt-2 text-xl font-black tabular-nums text-foreground">
                  {data.totalRewarded}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Rewarded
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <Coins className="mx-auto h-5 w-5 text-amber-500" />
                <p className="mt-2 text-xl font-black tabular-nums text-foreground">
                  {data.coinsEarned.toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Coins earned
                </p>
              </div>
            </div>

            {/* Apply someone else's code — only offered while it can still count */}
            {!data.referredBy && data.totalReferred === 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-bold text-foreground">
                  Were you invited by a friend?
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Enter their code before your first completed order so they get
                  their reward.
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="FRIENDCODE"
                    maxLength={20}
                    className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm font-bold uppercase tracking-wider text-foreground outline-none focus:border-primary"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleApplyCode}
                    disabled={applying || !code.trim()}
                    className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply
                  </motion.button>
                </div>
              </div>
            )}

            {/* Who you've referred */}
            {data.referrals.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    Your referrals
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {data.referrals.map((referral, index) => (
                    <div
                      key={`${referral.name}-${index}`}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {referral.name || "RozSewa customer"}
                        </p>
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Joined{" "}
                          {new Date(referral.joinedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      {referral.rewarded ? (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Rewarded
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="px-1 text-center text-[11px] font-medium leading-relaxed text-muted-foreground">
              Referral coins are credited once your friend's first order is
              completed. Coins are platform reward points and cannot be
              withdrawn as cash.
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default ReferEarn;
