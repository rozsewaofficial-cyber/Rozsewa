import re

file_path = r"d:\Rojsewa-main\frontend\src\modules\admin\pages\AdminSubscriptions.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update initial state
old_state = """  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    planType: "monthly",
    category: "",
    offeredCommissionRate: "",
    leadCredits: "",
    validity: "",
    description: "",
    features: [""],
    isActive: true
  });"""
new_state = """  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    planType: "monthly",
    category: "",
    commissionRate: "",
    leadCredits: "",
    duration: 365,
    settlementType: "monday",
    displayOrder: 0,
    description: "",
    features: [],
    isActive: true
  });"""
content = content.replace(old_state, new_state)

# 2. Update resetForm
old_reset = """  const resetForm = () => {
    setNewPlan({
      name: "",
      price: "",
      planType: "monthly",
      category: "",
      offeredCommissionRate: "",
      leadCredits: "",
      validity: "",
      description: "",
      features: [""],
      isActive: true
    });
  };"""
new_reset = """  const resetForm = () => {
    setNewPlan({
      name: "",
      price: "",
      planType: "monthly",
      category: "",
      commissionRate: "",
      leadCredits: "",
      duration: 365,
      settlementType: "monday",
      displayOrder: 0,
      description: "",
      features: [],
      isActive: true
    });
  };"""
content = content.replace(old_reset, new_reset)

# 3. Add predefined benefits array below imports
imports_idx = content.find("const AdminSubscriptions = () => {")
benefits = """
const PREDEFINED_BENEFITS = [
  "Priority Listing",
  "Verified Badge",
  "Homepage Priority",
  "Featured Partner",
  "Fast Settlement",
  "Banner Benefit"
];

"""
content = content[:imports_idx] + benefits + content[imports_idx:]

# 4. Form modifications
old_lead = """                    {categories.find(c => c._id === newPlan.category)?.businessModel === 'lead' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Lead Credits</label>
                          <input
                            type="number"
                            required
                            value={newPlan.leadCredits}
                            onChange={(e) => setNewPlan({ ...newPlan, leadCredits: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="e.g. 50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Validity (Days)</label>
                          <input
                            type="number"
                            required
                            value={newPlan.validity}
                            onChange={(e) => setNewPlan({ ...newPlan, validity: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="e.g. 365"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Commission Rate (%)</label>
                        <input
                          type="number"
                          required
                          value={newPlan.offeredCommissionRate}
                          onChange={(e) => setNewPlan({ ...newPlan, offeredCommissionRate: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                          placeholder="e.g. 5"
                        />
                      </div>
                    )}"""
                    
new_lead = """
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plan Duration (Days)</label>
                          <input
                            type="number"
                            required
                            value={newPlan.duration || ''}
                            onChange={(e) => setNewPlan({ ...newPlan, duration: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="e.g. 365"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Commission Rate (%)</label>
                          <input
                            type="number"
                            value={newPlan.commissionRate || ''}
                            onChange={(e) => setNewPlan({ ...newPlan, commissionRate: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="e.g. 5"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Settlement Type</label>
                          <select
                            value={newPlan.settlementType || 'monday'}
                            onChange={(e) => setNewPlan({ ...newPlan, settlementType: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                          >
                            <option value="monday">Monday (Weekly)</option>
                            <option value="24_hours">24 Hours (Daily)</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Display Order</label>
                          <input
                            type="number"
                            value={newPlan.displayOrder || 0}
                            onChange={(e) => setNewPlan({ ...newPlan, displayOrder: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="e.g. 1"
                          />
                        </div>
"""
content = content.replace(old_lead, new_lead)

# 5. Features Checkboxes
old_features_text = """                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plan Features (comma separated)</label>
                    <textarea
                      value={newPlan.features?.join(", ")}
                      onChange={(e) => setNewPlan({ ...newPlan, features: e.target.value.split(",").map(f => f.trim()) })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px]"
                      placeholder="e.g. Priority Support, 5% Commission, Verified Badge"
                    />
                  </div>"""

new_features_text = """                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Plan Benefits</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {PREDEFINED_BENEFITS.map(benefit => (
                        <label key={benefit} className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-blue-500/30 transition-all">
                          <input 
                            type="checkbox"
                            checked={newPlan.features?.includes(benefit) || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewPlan({ ...newPlan, features: [...(newPlan.features || []), benefit] });
                              } else {
                                setNewPlan({ ...newPlan, features: (newPlan.features || []).filter(f => f !== benefit) });
                              }
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 focus:ring-2 bg-white"
                          />
                          <span className="text-xs font-bold text-slate-700">{benefit}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Other Custom Benefits (Comma Separated)</label>
                    <textarea
                      value={(newPlan.features || []).filter(f => !PREDEFINED_BENEFITS.includes(f)).join(", ")}
                      onChange={(e) => {
                        const customFeatures = e.target.value.split(",").map(f => f.trim()).filter(f => f);
                        const existingPredefined = (newPlan.features || []).filter(f => PREDEFINED_BENEFITS.includes(f));
                        setNewPlan({ ...newPlan, features: [...existingPredefined, ...customFeatures] });
                      }}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                      placeholder="e.g. Dedicated RM, 24/7 Support"
                    />
                  </div>"""
content = content.replace(old_features_text, new_features_text)

# Also Category shouldn't be strictly required (global option)
content = content.replace('<option value="">Select Category</option>', '<option value="">Global / All Categories</option>')
# Also remove required validation for category
content = content.replace('!newPlan.name || !newPlan.category || !newPlan.price', '!newPlan.name || !newPlan.price')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated AdminSubscriptions.jsx")
