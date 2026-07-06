import os

file_path = r"d:\Rojsewa-main\frontend\src\modules\provider\components\RecentBookingsList.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add State
state_hook = """  const [filterCity, setFilterCity] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");"""

if "const [reportReason, setReportReason] = useState(\"\");" in content:
    content = content.replace(
        'const [reportReason, setReportReason] = useState("");',
        'const [reportReason, setReportReason] = useState("");\n' + state_hook
    )

# 2. Update filteredRequests logic
old_filter = """  const filteredRequests = requests.filter(req => {
    if (activeTab === "pending") return req.status === "pending";
    if (activeTab === "active") return ['confirmed', 'on_the_way', 'started'].includes(req.status) || (req.status === 'completed' && req.paymentStatus !== 'paid');
    if (activeTab === "completed") return req.status === "completed" && req.paymentStatus === 'paid';
    if (activeTab === "cancelled") return req.status === "cancelled";
    return true;
  });"""

new_filter = """  const filteredRequests = requests.filter(req => {
    if (activeTab === "pending" && req.status !== "pending") return false;
    if (activeTab === "active" && !(['confirmed', 'on_the_way', 'started'].includes(req.status) || (req.status === 'completed' && req.paymentStatus !== 'paid'))) return false;
    if (activeTab === "completed" && !(req.status === "completed" && req.paymentStatus === 'paid')) return false;
    if (activeTab === "cancelled" && req.status !== "cancelled") return false;

    // Filter by city/address
    if (filterCity) {
        const address = (req.address || "").toLowerCase();
        if (!address.includes(filterCity.toLowerCase())) {
            return false;
        }
    }
    
    // Filter by Date
    if (filterFromDate || filterToDate) {
        if (!req.bookingDate) return false;
        const bDate = new Date(req.bookingDate);
        if (filterFromDate) {
            const fDate = new Date(filterFromDate);
            if (bDate < fDate) return false;
        }
        if (filterToDate) {
            const tDate = new Date(filterToDate);
            if (bDate > tDate) return false;
        }
    }

    return true;
  });"""

if old_filter in content:
    content = content.replace(old_filter, new_filter)

# 3. Add UI below the tabs
old_ui = """      </div>

      <AnimatePresence mode="wait">"""

new_ui = """      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">Search City/Address</label>
          <input
            type="text"
            placeholder="e.g. Delhi, Mumbai..."
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">From Date</label>
          <input
            type="date"
            value={filterFromDate}
            onChange={(e) => setFilterFromDate(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">To Date</label>
          <input
            type="date"
            value={filterToDate}
            onChange={(e) => setFilterToDate(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={() => { setFilterCity(""); setFilterFromDate(""); setFilterToDate(""); }}
            className="w-full sm:w-auto px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-lg hover:bg-muted/80"
          >
            Clear
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">"""

if old_ui in content:
    content = content.replace(old_ui, new_ui)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated RecentBookingsList.jsx with filters")
