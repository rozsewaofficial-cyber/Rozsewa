import { motion } from "framer-motion";
import { Bell, Search, Menu } from "lucide-react";
import { Link } from "react-router-dom";

const AdminTopNav = ({ title = "Dashboard" }) => {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-8 shadow-sm">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-gray-500 hover:text-gray-900">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-extrabold text-gray-900 hidden sm:block">
          {title}
        </h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-4">
        {/* Notifications */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <div className="relative cursor-pointer rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </div>
        </motion.div>

        {/* Mobile Profile Avatar (Desktop has it in sidebar) */}
        <motion.div whileTap={{ scale: 0.9 }} className="md:hidden">
          <Link to="/admin/settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
            AD
          </Link>
        </motion.div>
      </div>
    </header>
  );
};

export default AdminTopNav;
