import { motion } from "framer-motion";
import { ArrowLeft, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import CoinWalletPanel from "@/components/CoinWalletPanel";

/** Customer-facing RozSewa Coins wallet. */
const RozSewaCoins = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <h1 className="text-xl font-bold text-foreground">RozSewa Coins</h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/refer-earn")}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-primary"
          >
            <Gift className="h-4 w-4" />
            Earn more
          </motion.button>
        </div>

        <CoinWalletPanel />
      </main>
      <BottomNav />
    </div>
  );
};

export default RozSewaCoins;
