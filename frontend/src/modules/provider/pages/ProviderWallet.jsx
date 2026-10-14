import { useState, useEffect, useRef } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Download,
  Link as LinkIcon,
  Building2,
  CheckCircle,
  Loader2,
  Landmark,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

// The server enforces the same bounds (paymentController).
const RECHARGE_MIN = 1;
const RECHARGE_MAX = 100000;

// ₹ amount with real paise, the paise a little smaller.
const Amount = ({ value, className = "" }) => {
  const [rupees, paise] = Number(value || 0)
    .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(".");
  return (
    <span className={className}>
      ₹{rupees}
      <span className="text-[0.5em] font-bold opacity-70">.{paise}</span>
    </span>
  );
};

const SectionTitle = ({ icon: Icon, count, children }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h2 className="text-sm font-black text-foreground">{children}</h2>
    {count ? (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
    ) : null}
  </div>
);

const Pager = ({ page, totalPages, onChange }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30">
    <button
      disabled={page <= 1}
      onClick={() => onChange(page - 1)}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" /> Prev
    </button>
    <span className="text-xs font-semibold text-muted-foreground">
      Page {page} of {totalPages}
    </span>
    <button
      disabled={page >= totalPages}
      onClick={() => onChange(page + 1)}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
    >
      Next <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

// 1949 -> "1,949", 1948.5 -> "1,948.50": rupees, with paise only when there are some.
const formatRupees = (value) => {
  const n = Number(value) || 0;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

// "14 Oct 2026, 3:05 pm"
const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
};

// A short label for what a transaction was (same rules as before, no emoji).
const txnTag = (txn) => {
  const t = txn.title || "";
  const d = txn.description || "";
  if (t.includes("Cash Collected")) return { label: "Cash", tone: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  if (t.includes("Commission Deducted")) return { label: "Commission", tone: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
  if (t.includes("Service Earnings")) return { label: "Online", tone: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  if (d.includes("Free") || t.includes("Free")) return { label: "Free service", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  if (t.includes("Penalty")) return { label: "Penalty", tone: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
  if (t.includes("Bonus")) return { label: "Bonus", tone: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" };
  return null;
};

const ProviderWallet = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // A statement grows for the life of the account, so the server sends one
  // page and says how many rows there are. Without the count the list would
  // page only through what it happened to be handed.
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const TRANSACTIONS_PER_PAGE = 10;
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);

  const fetchWithdrawals = async () => {
    try {
      const { data } = await API.get("/provider/withdrawals");
      setWithdrawals(data);
    } catch (err) {
      console.error("Failed to fetch withdrawals", err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchWithdrawals();
    reconcileRecharges();
  }, []);

  // Any recharge Razorpay took money for that the app never got to confirm.
  const reconcileRecharges = async ({ quiet = true } = {}) => {
    try {
      const { data } = await API.post("/payment/wallet/reconcile");
      const credited = data?.credited || [];
      if (credited.length) {
        const total = credited.reduce((sum, c) => sum + Number(c.amount || 0), 0);
        toast({ title: "Recharge added", description: `₹${total} from an earlier payment was added to your wallet.` });
        fetchWallet(1);
        window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
      }
      return credited;
    } catch {
      if (!quiet) toast({ title: "Couldn't confirm the payment yet", description: "If money was deducted, it will be added to your wallet automatically.", variant: "destructive" });
      return [];
    }
  };

  // The statement is paged by the server, so turning a page is a request.
  useEffect(() => {
    fetchWallet(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // The wallet moves without this screen's help — admin approves or rejects a
  // payout, a recharge is credited, a job pays out. The page only refreshed
  // on its own actions, so it showed the old balance and a payout as
  // "Pending" until it was reloaded. A burst of events is one refresh.
  useEffect(() => {
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetchWallet(currentPage);
        fetchWithdrawals();
      }, 500);
    };
    window.addEventListener("WALLET_UPDATED", refresh);
    window.addEventListener("NEW_NOTIFICATION", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("WALLET_UPDATED", refresh);
      window.removeEventListener("NEW_NOTIFICATION", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      setProvider(data);
    } catch (err) {
      console.error("Failed to load profile");
    }
  };

  const fetchWallet = async (page = currentPage) => {
    try {
      const { data } = await API.get("/wallet", {
        params: { page, limit: TRANSACTIONS_PER_PAGE }
      });
      setBalance(data.balance);
      setAvailableBalance(data.availableBalance || 0);
      setTransactions(data.transactions);
      setTransactionsTotal(data.transactionsTotal ?? data.transactions.length);
    } catch (err) {
      toast({ title: "Failed to load wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const isAddingBank = searchParams.get("modal") === "bank";

  const openBankModal = () => setSearchParams({ modal: "bank" });
  const closeBankModal = () => {
    setSearchParams({});
    setBankErrors({ accountNumber: "", ifscCode: "" });
  };

  const [bankData, setBankData] = useState({
    accountHolderName: "",
    accountNumber: "",
    bankName: "",
    ifscCode: "",
  });
  const [bankErrors, setBankErrors] = useState({
    accountNumber: "",
    ifscCode: "",
  });
  const isWithdrawing = searchParams.get("modal") === "withdraw";
  const openWithdrawModal = () => setSearchParams({ modal: "withdraw" });
  const closeWithdrawModal = () => {
    setSearchParams({});
    setWithdrawAmount("");
    setWithdrawError("");
  };

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  // True while a request is on its way, so a second tap can't send another.
  const [withdrawing, setWithdrawing] = useState(false);
  // The ref is what actually blocks a second tap: state only updates after
  // the render, and taps that land before it all saw "not sending" (three
  // fast taps sent three requests and held three payouts).
  const withdrawingRef = useRef(false);

  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeError, setRechargeError] = useState("");
  const isRecharging = searchParams.get("modal") === "recharge";
  const openRechargeModal = () => setSearchParams({ modal: "recharge" });
  const closeRechargeModal = () => {
    setSearchParams({});
    setRechargeAmount("");
    setRechargeError("");
  };

  useScrollLock(isWithdrawing || isAddingBank || isRecharging);

  const handleWithdraw = async () => {
    if (availableBalance <= 0) {
      toast({
        title: "Insufficient balance",
        description: "You need a positive balance to request a withdrawal.",
        variant: "destructive",
      });
      return;
    }

    if (!provider?.kycVerified) {
      toast({
        title: "KYC Required",
        description:
          "Withdrawal feature will be active after KYC verification.",
        variant: "destructive",
      });
      return;
    }

    if (!provider?.bankDetails?.accountNumber) {
      toast({
        title: "Bank Account Required",
        description: "Please link your bank account first.",
        variant: "destructive",
      });
      return;
    }

    openWithdrawModal();
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayAdmin = async () => {
    if (balance >= 0) return;
    const debtAmount = Math.abs(balance);
    setIsProcessing(true);
    const res = await loadRazorpay();

    if (!res) {
      toast({
        title: "Razorpay SDK failed to load. Are you online?",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", {
        amount: debtAmount,
        currency: "INR",
        purpose: "wallet",
      });

      const options = {
        // The key the order was created under (a different build-time key
        // made Razorpay fail the order).
        key: order.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Admin Settlement",
        description: "Clearing outstanding debt limits",
        order_id: order.id,
        modal: {
          ondismiss: () => toast({ title: "Payment cancelled", description: "No money was taken. Your wallet is unchanged." }),
        },
        handler: async function (response) {
          try {
            // No amount: the server credits what the order was paid for.
            await API.post("/payment/verify-wallet", response);
            toast({ title: "Debt cleared successfully!", variant: "default" });
            fetchWallet();
            window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
          } catch (error) {
            toast({
              title: "Payment verification failed",
              description:
                error.response?.data?.message || "Please contact support.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: provider?.ownerName,
          email: provider?.email,
          contact: provider?.mobile,
        },
        theme: { color: "#059669" }, // Emerald color
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response) {
        toast({
          title: "Payment failed",
          description: `${response.error?.description || "The payment didn't go through."} Your wallet balance is unchanged.`,
          variant: "destructive",
        });
      });
      paymentObject.open();
    } catch (error) {
      toast({
        title: "Failed to initialize payment",
        description: error.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    const amount = Math.round(parseFloat(rechargeAmount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) {
      setRechargeError("Please enter a valid amount.");
      return;
    }
    if (amount < RECHARGE_MIN || amount > RECHARGE_MAX) {
      setRechargeError(`Enter an amount between ₹${RECHARGE_MIN} and ₹${RECHARGE_MAX.toLocaleString("en-IN")}.`);
      return;
    }
    setRechargeError("");
    setIsProcessing(true);

    const res = await loadRazorpay();

    if (!res) {
      toast({
        title: "Razorpay SDK failed to load. Are you online?",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", {
        amount: amount,
        currency: "INR",
        purpose: "wallet",
      });

      const options = {
        // The key the order was created under (a different build-time key
        // made Razorpay fail the order).
        key: order.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Wallet Recharge",
        description: "Add money to wallet",
        order_id: order.id,
        modal: {
          // Closed without paying: nothing taken, nothing added.
          ondismiss: () => toast({ title: "Payment cancelled", description: "No money was taken. Your wallet balance is unchanged." }),
        },
        handler: async function (response) {
          try {
            // The server credits what the order was paid for, once.
            const { data } = await API.post("/payment/verify-wallet", response);
            toast({
              title: "Wallet recharged",
              description: data?.balance !== undefined
                ? `₹${data.amount} added. New balance ₹${Number(data.balance).toLocaleString("en-IN")}.`
                : "Money added to your wallet.",
            });
            setCurrentPage(1);
            fetchWallet(1);
            closeRechargeModal();
            window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
          } catch (error) {
            // Paid, but the confirmation didn't go through: check with the
            // gateway, which credits it if Razorpay captured the money.
            const credited = await reconcileRecharges({ quiet: true });
            if (credited.length) { closeRechargeModal(); return; }
            toast({
              title: "Payment not confirmed yet",
              description:
                error.response?.data?.message || "If money was deducted, it will be added to your wallet automatically.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: provider?.ownerName,
          email: provider?.email,
          contact: provider?.mobile,
        },
        theme: { color: "#059669" }, // Emerald color
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response) {
        toast({
          title: "Payment failed",
          description: `${response.error?.description || "The payment didn't go through."} Your wallet balance is unchanged.`,
          variant: "destructive",
        });
      });
      paymentObject.open();
    } catch (error) {
      toast({
        title: "Failed to initialize payment",
        description: error.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitWithdrawal = async (e) => {
    e.preventDefault();
    if (withdrawingRef.current) return;
    const raw = String(withdrawAmount).trim();
    const amount = Number(raw);
    if (raw === "" || !Number.isFinite(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid amount.");
      return;
    }
    // Rupees and paise only.
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
      setWithdrawError("Amount can have at most 2 decimal places.");
      return;
    }
    if (amount > availableBalance) {
      setWithdrawError(
        `Amount cannot exceed your available balance of ₹${formatRupees(availableBalance)}.`,
      );
      return;
    }
    setWithdrawError("");
    withdrawingRef.current = true;
    setWithdrawing(true);
    try {
      await API.post("/provider/withdraw", { amount });
      toast({
        title: "Withdrawal requested",
        description: `₹${formatRupees(amount)} is on hold until RozSewa processes your payout.`,
      });
      closeWithdrawModal();
      fetchWallet(1);
      setCurrentPage(1);
      fetchWithdrawals();
      window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
    } catch (err) {
      setWithdrawError(
        err.response?.data?.message || "Failed to submit request. Try again.",
      );
      // The balance may have changed under us (another device, another tap).
      fetchWallet();
    } finally {
      withdrawingRef.current = false;
      setWithdrawing(false);
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    const errors = { accountNumber: "", ifscCode: "" };
    // Account number: digits only, 9-18 characters
    if (!/^\d{9,18}$/.test(bankData.accountNumber)) {
      errors.accountNumber =
        "Account number must be 9–18 digits (numbers only).";
    }
    // IFSC: 4 letters + '0' + 6 alphanumeric
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankData.ifscCode)) {
      errors.ifscCode =
        "Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g. HDFC0001234).";
    }
    if (errors.accountNumber || errors.ifscCode) {
      setBankErrors(errors);
      return;
    }
    setBankErrors({ accountNumber: "", ifscCode: "" });
    try {
      await API.put("/provider/profile", { bankDetails: bankData });
      toast({
        title: "Bank Details Saved",
        description: "Your payout information has been updated successfully.",
      });
      closeBankModal();
      fetchProfile();
    } catch (err) {
      toast({
        title: "Couldn't save bank details",
        description: err.response?.data?.message || "Please check the details and try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditBank = () => {
    setBankData({
      accountHolderName: provider?.bankDetails?.accountHolderName || "",
      accountNumber: provider?.bankDetails?.accountNumber || "",
      bankName: provider?.bankDetails?.bankName || "",
      ifscCode: provider?.bankDetails?.ifscCode || "",
    });
    openBankModal();
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    if (!transactionsTotal) {
      toast({ title: "No transactions to download", variant: "destructive" });
      return;
    }

    // The screen holds one page. The statement is the whole ledger, so every
    // page is fetched (it used to export just the ten rows on screen).
    setDownloading(true);
    let all = [];
    try {
      const pageSize = 500;
      for (let page = 1; page <= 100; page++) {
        const { data } = await API.get("/wallet", { params: { page, limit: pageSize } });
        const rows = data?.transactions || [];
        all = all.concat(rows);
        if (rows.length < pageSize || all.length >= (data?.transactionsTotal ?? Infinity)) break;
      }
    } catch (err) {
      toast({ title: "Couldn't prepare the statement", description: "Please try again.", variant: "destructive" });
      setDownloading(false);
      return;
    }
    setDownloading(false);
    if (all.length === 0) {
      toast({ title: "No transactions to download", variant: "destructive" });
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Transaction ID",
      "Booking ID",
      "Title",
      "Type",
      "Amount (₹)",
      "Status",
      "Description",
    ];
    const csvContent = [
      headers.join(","),
      ...all.map((txn) => {
        const dateObj = new Date(txn.createdAt);
        const date = dateObj.toLocaleDateString("en-IN");
        const time = dateObj.toLocaleTimeString("en-IN");
        const type = txn.type === "credit" ? "Credit" : "Debit";
        const status = txn.status
          ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
          : "Completed";
        const bookingId = txn.bookingId || "N/A";
        const description = txn.description
          ? `"${txn.description.replace(/"/g, '""')}"`
          : "";
        const title = txn.title ? `"${txn.title.replace(/"/g, '""')}"` : "";
        return `${date},${time},${txn._id},${bookingId},${title},${type},${txn.amount},${status},${description}`;
      }),
    ].join("\n");

    // The BOM makes Excel read the ₹ in the header as UTF-8 instead of garbage.
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Wallet_History_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      ) : (
        <main className="container max-w-4xl px-4 pt-6 pb-28 md:py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                Wallet
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Earnings, payouts and dues
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Statement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings — what can be withdrawn */}
            <section
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-800 dark:to-teal-900 p-4 md:p-5 text-white shadow-lg shadow-emerald-900/10 flex flex-col"
              data-wallet-earnings
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
              <div className="relative flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-50/90">
                    Available to withdraw
                  </p>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                    <Wallet className="h-3.5 w-3.5" />
                  </span>
                </div>
                <Amount value={availableBalance > 0 ? availableBalance : 0} className="mt-1 text-3xl font-black tracking-tight" />
                <p className="mt-0.5 text-[11px] text-emerald-50/80 truncate">
                  {availableBalance > 0 ? "Earnings after commission" : "Earnings from completed jobs appear here"}
                  {" · "}
                  {provider?.bankDetails?.accountNumber
                    ? `to ${provider.bankDetails.bankName || "your bank"} ••••${provider.bankDetails.accountNumber.slice(-4)}`
                    : "add a bank to withdraw"}
                </p>
                <div className="mt-auto pt-3">
                  <button
                    onClick={handleWithdraw}
                    disabled={availableBalance <= 0}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all ${availableBalance <= 0 ? "bg-white/20 text-white/60 cursor-not-allowed" : "bg-white text-emerald-800 shadow-md hover:bg-emerald-50 active:scale-[0.98]"}`}
                  >
                    <ArrowUpRight className="h-4 w-4" /> Withdraw
                  </button>
                </div>
              </div>
            </section>

            {/* Prepaid wallet — commission & leads, or dues owed */}
            <section
              className={`rounded-3xl border p-4 md:p-5 shadow-sm flex flex-col ${balance < 0 ? "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30" : "border-border bg-card"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* The prepaid wallet a recharge adds to. It was only ever shown
                      when negative (as dues), so a recharge changed nothing on
                      screen and looked like it had failed. */}
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wider ${balance < 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}
                    data-wallet-balance={balance}
                  >
                    {balance < 0 ? "Cash Commission Dues" : "Wallet Balance"}
                  </p>
                  <Amount
                    value={Math.abs(balance || 0)}
                    className={`mt-1 block text-3xl font-black tracking-tight ${balance < 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground"}`}
                  />
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${balance < 0 ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                  {balance < 0 ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </span>
              </div>
              <p className={`mt-0.5 text-[11px] ${balance < 0 ? "text-rose-700/90 dark:text-rose-300/90" : "text-muted-foreground"}`}>
                {balance < 0
                  ? "Commission owed to RozSewa. Pay it to keep receiving bookings."
                  : "Prepaid balance used for commission and lead unlocks. No dues pending."}
              </p>
              <div className="mt-auto pt-3">
                <button
                  onClick={balance < 0 ? handlePayAdmin : () => openRechargeModal()}
                  disabled={isProcessing}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all active:scale-[0.98] disabled:opacity-60 ${
                    balance < 0
                      ? "bg-rose-600 text-white shadow-md hover:bg-rose-700"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                  ) : balance < 0 ? (
                    <>Pay ₹{Math.abs(balance).toLocaleString("en-IN")} now</>
                  ) : (
                    <><Plus className="h-4 w-4" /> Add money</>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Payout account */}
          <section className="space-y-3">
            <SectionTitle icon={Building2}>Payout account</SectionTitle>
            {provider?.bankDetails?.accountNumber ? (
              <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {provider.bankDetails.bankName || "Bank account"} ••••{provider.bankDetails.accountNumber.slice(-4)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {provider.bankDetails.accountHolderName || "Primary account"}
                    </span>
                    {provider.bankDetails.verified && (
                      <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleEditBank}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            ) : (
              <button
                onClick={() => openBankModal()}
                className="w-full rounded-2xl border-2 border-dashed border-border bg-card/50 p-4 flex items-center gap-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:group-hover:bg-emerald-900/40 dark:group-hover:text-emerald-300">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Add bank account</p>
                  <p className="text-xs text-muted-foreground">Needed to withdraw your earnings</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </section>

          {/* Withdrawal requests */}
          {withdrawals.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={Landmark} count={withdrawals.length}>Withdrawal requests</SectionTitle>
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
                {(() => {
                  const itemsPerPage = 10;
                  const totalPages = Math.ceil(withdrawals.length / itemsPerPage);
                  const startIndex = (withdrawalsPage - 1) * itemsPerPage;
                  const paginated = withdrawals.slice(startIndex, startIndex + itemsPerPage);
                  const tone = (s) =>
                    s === "approved"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : s === "rejected"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

                  return (
                    <>
                      {paginated.map((req) => (
                        <div key={req._id} className="p-4 flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone(req.status)}`}>
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-foreground">Withdrawal to bank</p>
                              <p className="shrink-0 text-sm font-black text-foreground">
                                ₹{Number(req.amount || 0).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize ${tone(req.status)}`}>
                                {req.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(req.createdAt)}
                              </span>
                            </div>
                            {req.reason && (
                              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                                Reason: {req.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {totalPages > 1 && (
                        <Pager page={withdrawalsPage} totalPages={totalPages} onChange={setWithdrawalsPage} />
                      )}
                    </>
                  );
                })()}
              </div>
            </section>
          )}

          {/* Transactions */}
          <section className="space-y-3">
            <SectionTitle icon={History} count={transactionsTotal || undefined}>Transactions</SectionTitle>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
              {(() => {
                const itemsPerPage = TRANSACTIONS_PER_PAGE;
                // Over every row there is, not over the ones in hand.
                const totalPages = Math.max(1, Math.ceil(transactionsTotal / itemsPerPage));
                // Already this page; nothing left to slice.
                const paginated = transactions;

                if (transactionsTotal === 0) {
                  return (
                    <div className="px-6 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <History className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-foreground">No transactions yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Earnings, recharges and commission will show up here.
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {paginated.map((txn) => {
                      const credit = txn.type === "credit";
                      const tag = txnTag(txn);
                      // A held payout is pending; a rejected one moved no money.
                      const failed = txn.status === "failed";
                      const pending = txn.status === "pending";
                      return (
                        <div key={txn._id} className="p-4 flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${credit ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"}`}>
                            {credit ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                                {txn.title}
                              </p>
                              <p className={`shrink-0 text-sm font-black ${failed ? "text-muted-foreground line-through" : credit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {credit ? "+" : "−"}₹{formatRupees(txn.amount)}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                              {pending && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  Pending
                                </span>
                              )}
                              {failed && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  Not processed · returned to wallet
                                </span>
                              )}
                              {tag && (
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tag.tone}`}>
                                  {tag.label}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(txn.createdAt)}
                              </span>
                            </div>
                            {txn.paymentId ? (
                              <p className="mt-1 text-[11px] text-muted-foreground break-all">
                                {txn.paymentMethod || "Razorpay"} · Txn {txn.paymentId}
                                {txn.balanceAfter !== undefined && txn.balanceAfter !== null && (
                                  <> · Balance after ₹{Number(txn.balanceAfter).toLocaleString("en-IN")}</>
                                )}
                              </p>
                            ) : txn.description && (
                              <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                                {txn.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {totalPages > 1 && (
                      <Pager page={currentPage} totalPages={totalPages} onChange={setCurrentPage} />
                    )}
                  </>
                );
              })()}
            </div>
          </section>
        </main>
      )}

      {/* Add Bank Modal */}
      {isAddingBank && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative"
          >
            <button
              onClick={() => closeBankModal()}
              className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            >
              <ArrowDownRight className="h-5 w-5 rotate-45" />
            </button>
            <h2 className="text-2xl font-black tracking-tighter mb-1">
              Add Bank Account
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Payouts will be sent to this account securely.
            </p>

            <form onSubmit={saveBank} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                  Account Holder Name
                </label>
                <input
                  required
                  value={bankData.accountHolderName}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                    setBankData({ ...bankData, accountHolderName: val });
                  }}
                  className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                  Account Number
                </label>
                <input
                  required
                  value={bankData.accountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 18);
                    setBankData({ ...bankData, accountNumber: val });
                    setBankErrors((prev) => ({ ...prev, accountNumber: "" }));
                  }}
                  inputMode="numeric"
                  maxLength={18}
                  className={`w-full h-14 px-5 rounded-2xl bg-muted border focus:bg-background transition-all outline-none font-bold text-sm ${
                    bankErrors.accountNumber
                      ? "border-rose-400 focus:border-rose-500"
                      : "border-transparent focus:border-emerald-500/50"
                  }`}
                  placeholder="e.g. 123456789012"
                />
                {bankErrors.accountNumber && (
                  <p className="text-[10px] font-bold text-rose-500 ml-1">
                    {bankErrors.accountNumber}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                    IFSC Code
                  </label>
                  <input
                    required
                    value={bankData.ifscCode}
                    onChange={(e) => {
                      const val = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 11);
                      setBankData({ ...bankData, ifscCode: val });
                      setBankErrors((prev) => ({ ...prev, ifscCode: "" }));
                    }}
                    maxLength={11}
                    className={`w-full h-14 px-5 rounded-2xl bg-muted border focus:bg-background transition-all outline-none font-bold text-sm ${
                      bankErrors.ifscCode
                        ? "border-rose-400 focus:border-rose-500"
                        : "border-transparent focus:border-emerald-500/50"
                    }`}
                    placeholder="HDFC0001234"
                  />
                  {bankErrors.ifscCode && (
                    <p className="text-[10px] font-bold text-rose-500 ml-1">
                      {bankErrors.ifscCode}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                    Bank Name
                  </label>
                  <input
                    required
                    value={bankData.bankName}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      setBankData({ ...bankData, bankName: val });
                    }}
                    className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm"
                    placeholder="HDFC Bank"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all"
              >
                Save Bank Details
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {isWithdrawing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative"
          >
            <button
              onClick={() => closeWithdrawModal()}
              className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            >
              <ArrowDownRight className="h-5 w-5 rotate-45" />
            </button>
            <h2 className="text-2xl font-black tracking-tighter mb-1">
              Request Withdrawal
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Enter the amount you want to withdraw.
            </p>

            <form onSubmit={submitWithdrawal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                  Amount (Max: ₹{formatRupees(availableBalance)})
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max={availableBalance}
                  step="0.01"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || parseFloat(v) > 0) {
                      setWithdrawAmount(v);
                      setWithdrawError("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E")
                      e.preventDefault();
                  }}
                  className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm"
                  placeholder="500"
                />

                {withdrawError && (
                  <p className="text-[11px] font-bold text-rose-500 px-1 mt-1">
                    {withdrawError}
                  </p>
                )}
                {/* Quick Presets: only amounts that are within what can be withdrawn */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[500, 1000].filter((v) => v <= availableBalance).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setWithdrawAmount(String(v)); setWithdrawError(""); }}
                      className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors"
                    >
                      ₹{v.toLocaleString("en-IN")}
                    </button>
                  ))}
                  {/* The whole of the earnings (availableBalance) — this used
                      to fill the prepaid wallet figure, a different amount. */}
                  <button
                    type="button"
                    onClick={() => { setWithdrawAmount(String(Math.floor(availableBalance * 100) / 100)); setWithdrawError(""); }}
                    className="h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 font-bold text-xs transition-colors"
                  >
                    All
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={withdrawing}
                className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {withdrawing ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Recharge Modal */}
      {isRecharging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative"
          >
            <button
              onClick={() => closeRechargeModal()}
              className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            >
              <ArrowDownRight className="h-5 w-5 rotate-45" />
            </button>
            <h2 className="text-2xl font-black tracking-tighter mb-1">
              Recharge Wallet
            </h2>
            <p className="text-sm text-muted-foreground mb-2">
              Add money to your wallet to pay for commission dues or leads.
            </p>
            <p className="text-xs font-bold text-muted-foreground mb-6">
              {balance < 0 ? "Cash commission dues: " : "Current wallet balance: "}
              <span className={balance < 0 ? "text-rose-600" : "text-foreground"}>₹{formatRupees(Math.abs(balance || 0))}</span>
            </p>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                  Amount (₹)
                </label>
                <input
                  required
                  type="number"
                  min={RECHARGE_MIN}
                  max={RECHARGE_MAX}
                  step="0.01"
                  inputMode="decimal"
                  value={rechargeAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || parseFloat(v) > 0) {
                      setRechargeAmount(v);
                      setRechargeError("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E")
                      e.preventDefault();
                  }}
                  className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm"
                  placeholder="500"
                />

                {rechargeError && (
                  <p className="text-[11px] font-bold text-rose-500 px-1 mt-1">
                    {rechargeError}
                  </p>
                )}
                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRechargeAmount("500")}
                    className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors"
                  >
                    ₹500
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechargeAmount("1000")}
                    className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors"
                  >
                    ₹1000
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechargeAmount("2000")}
                    className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors"
                  >
                    ₹2000
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Proceed to Pay"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderWallet;
