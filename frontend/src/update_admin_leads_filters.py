import os

file_path = r"d:\Rojsewa-main\frontend\src\modules\admin\pages\AdminLeads.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add state
state_hook = """  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");"""

if 'const [search, setSearch] = useState("");' in content:
    content = content.replace('const [search, setSearch] = useState("");', state_hook)

# 2. Update filteredLeads
old_filter = """      .filter(l => {
        const searchLower = search.toLowerCase();
        const serviceName = l.service || l.requirementTitle || l.categoryId?.name || '';
        return (
          !search || 
          l._id.toLowerCase().includes(searchLower) || 
          serviceName.toLowerCase().includes(searchLower) || 
          (l.customer?.name || '').toLowerCase().includes(searchLower)
        );
      });
  }, [leads, filter, search]);"""

new_filter = """      .filter(l => {
        const searchLower = search.toLowerCase();
        const serviceName = l.service || l.requirementTitle || l.categoryId?.name || '';
        
        // Search text
        if (search && !l._id.toLowerCase().includes(searchLower) && !serviceName.toLowerCase().includes(searchLower) && !(l.customer?.name || '').toLowerCase().includes(searchLower)) {
            return false;
        }

        // City / Address filter
        if (filterCity) {
            const addr = [
                l.locationDetail?.houseNo, l.locationDetail?.apartment, l.locationDetail?.street, 
                l.locationDetail?.landmark, l.locationDetail?.area, l.locationDetail?.city, 
                l.locationDetail?.state, l.locationDetail?.pincode
            ].filter(Boolean).join(', ') + ' ' + (l.requirementForm?.address || '');
            
            if (!addr.toLowerCase().includes(filterCity.toLowerCase())) {
                return false;
            }
        }

        // Date filter
        if (filterFromDate || filterToDate) {
            if (!l.createdAt) return false;
            const bDate = new Date(l.createdAt);
            if (filterFromDate) {
                const fDate = new Date(filterFromDate);
                fDate.setHours(0,0,0,0);
                if (bDate < fDate) return false;
            }
            if (filterToDate) {
                const tDate = new Date(filterToDate);
                tDate.setHours(23,59,59,999);
                if (bDate > tDate) return false;
            }
        }

        return true;
      });
  }, [leads, filter, search, filterCity, filterFromDate, filterToDate]);"""

if old_filter in content:
    content = content.replace(old_filter, new_filter)

# 3. Add UI below search bar
old_ui = """      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by lead ID, customer, service..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">"""

new_ui = """      {/* Filters and Search Bar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-[2]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="Search by lead ID, customer, service..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
            />
            </div>
            
            <div className="flex-1">
            <input 
                type="text" 
                placeholder="City / Address..." 
                value={filterCity} 
                onChange={e => setFilterCity(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
            />
            </div>
            <div className="flex-1">
            <input 
                type="date" 
                value={filterFromDate} 
                onChange={e => setFilterFromDate(e.target.value)}
                title="From Date"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-slate-500" 
            />
            </div>
            <div className="flex-1">
            <input 
                type="date" 
                value={filterToDate} 
                onChange={e => setFilterToDate(e.target.value)}
                title="To Date"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-slate-500" 
            />
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">"""

if old_ui in content:
    content = content.replace(old_ui, new_ui)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated AdminLeads.jsx with filters")
