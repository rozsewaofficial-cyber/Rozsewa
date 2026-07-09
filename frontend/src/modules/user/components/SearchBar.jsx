import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, ArrowRight } from "lucide-react";
import API from "@/lib/api";

const SearchBar = ({ onSearch, onFilterClick, initialValue = "", hideFilterIcon = false }) => {
  const [query, setQuery] = useState(initialValue);
  const [categories, setCategories] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const { data } = await API.get('/public/categories');
        setCategories(data);
      } catch(e) {}
    };
    fetchCats();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const filtered = query.trim() 
    ? categories.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];

  return (
    <form 
      ref={wrapperRef}
      onSubmit={(e) => {
        e.preventDefault();
        setShowSuggestions(false);
        onSearch?.(query);
      }}
      className="w-full relative z-[60]"
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
          onChange={(e) => {
             setQuery(e.target.value);
             setShowSuggestions(true);
          }}
          onFocus={() => {
             if (query.trim()) setShowSuggestions(true);
          }}
          className={`w-full rounded-[20px] border-none bg-white/70 dark:bg-slate-800/50 backdrop-blur-md py-4 pl-12 ${hideFilterIcon ? 'pr-6' : 'pr-14'} text-[13px] font-medium text-slate-900 dark:text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] transition-all focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400`}
        />
        {!hideFilterIcon && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button 
              type="button"
              onClick={() => {
                setShowSuggestions(false);
                onFilterClick?.(query);
              }}
              className="h-9 w-9 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
              <SlidersHorizontal className="h-[14px] w-[14px]" />
            </button>
          </div>
        )}
      </motion.div>
      
      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[20px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 overflow-hidden z-[60]"
          >
            {filtered.map((cat, idx) => (
              <button
                key={cat._id || idx}
                type="button"
                onClick={() => {
                  setQuery(cat.name);
                  setShowSuggestions(false);
                  onSearch?.(cat.name);
                }}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-100/50 dark:border-slate-800/50 last:border-0 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Search className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
};

export default SearchBar;
