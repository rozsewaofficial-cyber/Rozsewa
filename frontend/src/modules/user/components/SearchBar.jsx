import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";

const SearchBar = ({ onSearch, onFilterClick, initialValue = "", hideFilterIcon = false }) => {
  const [query, setQuery] = useState(initialValue);

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSearch?.(query);
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
          className={`w-full rounded-[20px] border-none bg-white/70 dark:bg-slate-800/50 backdrop-blur-md py-4 pl-12 ${hideFilterIcon ? 'pr-6' : 'pr-14'} text-[13px] font-medium text-slate-900 dark:text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] transition-all focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400`}
        />
        {!hideFilterIcon && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button 
              type="button"
              onClick={onFilterClick}
              className="h-9 w-9 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
              <SlidersHorizontal className="h-[14px] w-[14px]" />
            </button>
          </div>
        )}
      </motion.div>
    </form>
  );
};

export default SearchBar;
