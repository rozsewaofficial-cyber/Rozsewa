import { motion } from "framer-motion";
import { Bell, Search, Menu } from "lucide-react";
import { Link } from "react-router-dom";

const AdminTopNav = ({ title = "Dashboard" }) => {
  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 backdrop-blur-xl px-4 md:px-10 transition-all duration-300 shadow-sm">
      <div className="flex items-center gap-4">
        <button className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors shadow-sm">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight hidden sm:block">
          {title}
        </h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-5">
        {/* Global Search */}
        <div className="hidden md:flex relative w-64 lg:w-80">
           <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
           <input 
             type="text" 
             placeholder="Search across RozSewa..." 
             className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold text-gray-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner placeholder:font-semibold placeholder:text-gray-400" 
           />
           <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 shadow-sm">
             <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">CTRL+K</span>
           </div>
        </div>

        {/* Notifications */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <div className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
          </div>
        </motion.div>

        {/* Mobile Profile Avatar (Desktop has it in sidebar) */}
        <motion.div whileTap={{ scale: 0.9 }} className="md:hidden">
          <Link to="/admin/settings" className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-black text-sm shadow-sm">
            AD
          </Link>
        </motion.div>
      </div>
    </header>
  );
};

export default AdminTopNav;
