import { motion } from "framer-motion";
import { Sparkles, Clock, CalendarCheck } from "lucide-react";

const HierarchicalServiceCard = ({ service, onBookNow }) => {
  const { name, image, description } = service;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative flex flex-col sm:flex-row items-stretch gap-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all"
    >
      {/* Optional Image / Icon */}
      <div className="relative h-36 sm:h-auto sm:w-36 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4">
            <Sparkles className="h-10 w-10 text-primary/60 mb-1" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">RozSewa Local Expert</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
              {name}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {description || "Professional service delivered at your doorstep by verified partner experts."}
          </p>
        </div>

        {/* Book Now — pricing is negotiated directly with the Local Expert, not shown here */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onBookNow(service)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all"
          >
            <CalendarCheck className="h-4 w-4" />
            Book Now
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default HierarchicalServiceCard;
