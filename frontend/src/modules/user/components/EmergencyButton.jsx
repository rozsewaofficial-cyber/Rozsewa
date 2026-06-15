import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmergencyButton = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.03 }}
      onClick={() => navigate("/shops?emergency=true")}
      className="relative w-full rounded-2xl bg-amber-400 hover:bg-amber-500 px-6 py-4 font-bold text-amber-950 shadow-[0_0_25px_rgba(251,191,36,0.4)] transition-all border border-amber-300"
      style={{ animation: "pulse-glow 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
    >
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <Zap className="h-5 w-5 sm:h-6 sm:w-6 fill-current shrink-0" />
        </motion.div>
        <div className="text-left">
          <div className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">Emergency Service 24×7</div>
          <div className="text-[10px] sm:text-xs font-medium opacity-80 mt-0.5 sm:mt-0 leading-tight">Tap for instant help — Plumber, Electrician & more</div>
        </div>
        <Zap className="hidden sm:block h-5 w-5 fill-current opacity-60 shrink-0" />
      </div>
    </motion.button>
  );
};

export default EmergencyButton;
