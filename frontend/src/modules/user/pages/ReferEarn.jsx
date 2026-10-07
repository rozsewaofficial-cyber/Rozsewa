import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Share2,
  Copy,
  Check,
  Users,
  Coins,
  Trophy,
  Loader2,
  CheckCircle2,
  Clock,
  Ban,
  UserPlus,
  ShoppingBag,
  Link2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { getDeviceId, inviteLink } from "@/lib/referral";

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.24 9.42-9.44 9.42m8.02-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.71 5.8.71 12.05c0 2 .52 3.95 1.52 5.66L.62 23.6l6.03-1.58a11.3 11.3 0 0 0 5.4 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.33-8.02" />
  </svg>
);

const STATUS = {
  rewarded: {
    label: "Rewarded",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blocked: {
    label: "Not eligible",
    icon: Ban,
    className: "bg-muted text-muted-foreground",
  },
};

const statusOf = (referral) =>
  referral.status || (referral.rewarded ? "rewarded" : "pending");

const initials = (name) =>
  String(name || "R")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "R";

const ReferEarn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadReferral = async () => {
    const { data: referral } = await API.get("/coins/referral", {
      params: { deviceId: getDeviceId() },
    });
    setData(referral);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadReferral();
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

  const link = data?.referralCode ? inviteLink(data.referralCode) : "";
  // The link carries the code, so the friend's account is linked to this one
  // when they sign up through it — the bare site address linked nobody.
  const message = data?.referralCode
    ? `Join me on RozSewa for trusted home services. Sign up with my link (code ${data.referralCode}): ${link}`
    : "";

  const copyText = async (text, title) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title });
      return true;
    } catch {
      toast({ title: "Couldn't copy", description: "Please copy it manually.", variant: "destructive" });
      return false;
    }
  };

  const handleCopyCode = async () => {
    if (!data?.referralCode) return;
    if (await copyText(data.referralCode, "Referral code copied")) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!message) return;
    // Native share sheet where the browser supports it, clipboard everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on RozSewa", text: message });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // the user closed the sheet
      }
    }
    copyText(message, "Invite link copied");
  };

  const handleWhatsApp = () => {
    if (!message) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleApplyCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setApplying(true);
    try {
      const { data: result } = await API.post("/coins/referral/apply", {
        code: trimmed,
        deviceId: getDeviceId(),
      });
      toast({ title: "Referral code applied", description: result.message });
      setCode("");
      await loadReferral();
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

  const steps = data
    ? [
        { icon: Link2, title: "Share your link", text: "Send your invite link to friends and family." },
        { icon: UserPlus, title: "Friend signs up", text: "Your code is added when they join through your link." },
        { icon: ShoppingBag, title: "First order completed", text: `You get ${data.rewardCoins.toLocaleString("en-IN")} coins when their first order is done.` },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <TopNav />
      <main className="container max-w-2xl space-y-5 px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/profile")}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold leading-tight text-foreground">Refer & Earn</h1>
            <p className="text-xs text-muted-foreground">Invite friends to RozSewa and earn coins</p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Referral details aren't available right now.</p>
            <p className="mt-1 text-xs text-muted-foreground">Please check your connection and try again.</p>
          </div>
        ) : (
          <>
            {/* Reward + code */}
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="relative overflow-hidden bg-gradient-to-br from-primary to-emerald-700 px-6 pb-6 pt-6 text-primary-foreground">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Earn for every friend</p>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold tabular-nums">{data.rewardCoins.toLocaleString("en-IN")}</span>
                      <span className="text-base font-semibold text-white/85">coins</span>
                    </p>
                    <p className="mt-1 text-sm text-white/80">Worth ₹{data.rewardValue} in RozSewa Coins</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <Gift className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Your referral code</p>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-2 pl-4 pr-2">
                    <span className="font-mono text-xl font-bold tracking-[0.18em] text-foreground">
                      {data.referralCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-card px-3 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border hover:bg-muted"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleWhatsApp}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white shadow-sm hover:brightness-95"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    WhatsApp
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleShare}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background shadow-sm hover:opacity-90"
                  >
                    <Share2 className="h-4 w-4" />
                    Share link
                  </motion.button>
                </div>

                <p className="truncate text-center text-[11px] text-muted-foreground" title={link}>
                  {link.replace(/^https?:\/\//, "")}
                </p>
              </div>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, value: data.totalReferred, label: "Referred", tone: "text-sky-500" },
                { icon: Trophy, value: data.totalRewarded, label: "Rewarded", tone: "text-emerald-500" },
                { icon: Coins, value: data.coinsEarned.toLocaleString("en-IN"), label: "Coins earned", tone: "text-amber-500" },
              ].map(({ icon: Icon, value, label, tone }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-4">
                  <Icon className={`h-5 w-5 ${tone}`} />
                  <p className="mt-3 text-2xl font-bold tabular-nums leading-none text-foreground">{value}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>
            {data.pending > 0 && (
              <p className="-mt-2 text-center text-xs text-muted-foreground">
                {data.pending} {data.pending === 1 ? "friend is" : "friends are"} yet to complete their first order.
              </p>
            )}

            {/* How it works */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">How it works</h2>
              <ol className="mt-4 space-y-4">
                {steps.map(({ icon: Icon, title, text }, index) => (
                  <li key={title} className="relative flex gap-3">
                    {index < steps.length - 1 && (
                      <span className="absolute left-[17px] top-10 h-[calc(100%-24px)] w-px bg-border" aria-hidden="true" />
                    )}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Apply someone else's code — only offered while it can still count */}
            {!data.referredBy && data.totalReferred === 0 && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">Were you invited by a friend?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter their code before your first completed order so they get their reward.
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCode()}
                    placeholder="Enter code"
                    maxLength={20}
                    aria-label="Friend's referral code"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-sm font-semibold uppercase tracking-widest text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleApplyCode}
                    disabled={applying || !code.trim()}
                    className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply
                  </motion.button>
                </div>
              </section>
            )}

            {/* Who you've referred */}
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Your referrals</h2>
                {data.totalReferred > 0 && (
                  <span className="text-xs text-muted-foreground">{data.totalReferred} total</span>
                )}
              </div>
              {data.referrals.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">No referrals yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Friends who sign up with your link will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.referrals.map((referral, index) => {
                    const status = STATUS[statusOf(referral)] || STATUS.pending;
                    const StatusIcon = status.icon;
                    return (
                      <li key={`${referral.name}-${index}`} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initials(referral.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {referral.name || "RozSewa customer"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined{" "}
                            {new Date(referral.joinedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span
                          title={referral.blockedReason || ""}
                          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              {data.condition} Coins are reward points for RozSewa services and can't be withdrawn as cash.
              Referrals from the same phone or account aren't eligible.
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default ReferEarn;
