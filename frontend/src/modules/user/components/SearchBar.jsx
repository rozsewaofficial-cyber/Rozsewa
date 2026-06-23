import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, Star, MapPin, Zap } from "lucide-react";
import { createPortal } from "react-dom";

const SearchBar = ({ onSearch, initialValue = "" }) => {
  const [query, setQuery] = useState(initialValue);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const applyFilter = (filter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    // You can extend onSearch to handle filter objects, but for now we just pass query
    if (onSearch) onSearch(query, filter);
  };

  return (
    <>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.(query, activeFilter);
        }}
        className="w-full"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center w-full"
        >
          <button type="submit" className="absolute inset-y-0 left-5 flex items-center z-10 hover:text-blue-500 transition-colors">
            <Search className="h-[18px] w-[18px] text-slate-400 hover:text-blue-500" />
          </button>
          <input
            type="text"
            value={query}
            placeholder="Try plumbing, handyman, roofing..."
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[20px] border-none bg-white/70 dark:bg-slate-800/50 backdrop-blur-md py-4 pl-12 pr-14 text-[13px] font-medium text-slate-900 dark:text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] transition-all focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button 
              type="button"
              onClick={() => setShowFilters(true)}
              className="h-9 w-9 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
              <SlidersHorizontal className="h-[14px] w-[14px]" />
            </button>
          </div>
        </motion.div>
      </form>

      {createPortal(
        <AnimatePresence>
          {showFilters && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowFilters(false)}
                className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[110] bg-white dark:bg-slate-900 rounded-t-[32px] p-6 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Quick Filters</h3>
                  <button onClick={() => setShowFilters(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  <button onClick={() => applyFilter('top-rated')} className={`w-full flex items-center justify-between p-4 rounded-[20px] border-2 transition-all ${activeFilter === 'top-rated' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${activeFilter === 'top-rated' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Star className="w-4 h-4" /></div>
                      <span className="text-[14px] font-bold text-slate-900 dark:text-white">Top Rated Providers</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${activeFilter === 'top-rated' ? 'border-blue-600' : 'border-slate-300'}`}>
                      {activeFilter === 'top-rated' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </div>
                  </button>

                  <button onClick={() => applyFilter('nearby')} className={`w-full flex items-center justify-between p-4 rounded-[20px] border-2 transition-all ${activeFilter === 'nearby' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${activeFilter === 'nearby' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><MapPin className="w-4 h-4" /></div>
                      <span className="text-[14px] font-bold text-slate-900 dark:text-white">Nearest to me (&lt; 5km)</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${activeFilter === 'nearby' ? 'border-blue-600' : 'border-slate-300'}`}>
                      {activeFilter === 'nearby' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </div>
                  </button>
                </div>

                <button onClick={() => { setShowFilters(false); if(onSearch) onSearch(query, activeFilter); }} className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-[16px] font-black text-[13px] tracking-widest uppercase hover:opacity-90 transition-opacity">
                  Show Results
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default SearchBar;
