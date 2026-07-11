import { motion } from "framer-motion";
import { Home, Search, ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
          <Search className="h-12 w-12 text-primary" />
        </motion.div>
        <h1 className="text-6xl font-black text-foreground">404</h1>
        <p className="mt-2 text-lg font-semibold text-muted-foreground">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/')} className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/")} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
            <Home className="h-4 w-4" /> Home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
