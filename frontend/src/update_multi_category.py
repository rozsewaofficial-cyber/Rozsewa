import os

file_path = r"d:\Rojsewa-main\frontend\src\modules\admin\pages\AdminPartnerPolicies.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace selectedCategory state with selectedCategories array
content = content.replace(
    "const [selectedCategory, setSelectedCategory] = useState('');",
    "const [selectedCategories, setSelectedCategories] = useState([]);"
)

# Update useEffect
content = content.replace(
"""  useEffect(() => {
    if (selectedCategory) {
      fetchPolicy(selectedCategory);
    } else {""",
"""  useEffect(() => {
    if (selectedCategories.length === 1) {
      fetchPolicy(selectedCategories[0]);
    } else if (selectedCategories.length === 0) {"""
)

# Update fetchCategories
content = content.replace(
"""      if (data.length > 0) {
        setSelectedCategory(data[0]._id);
      }""",
"""      if (data.length > 0) {
        setSelectedCategories([data[0]._id]);
      }"""
)

# Update handleSave
content = content.replace(
"""  const handleSave = async () => {
    if (!selectedCategory) {
      toast({ title: 'Please select a category first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await API.post('/admin/partner-policies', { ...policy, category: selectedCategory });
      toast({ title: 'Category Policy Saved Successfully!' });
      fetchPolicy(selectedCategory);""",
"""  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      toast({ title: 'Please select at least one category', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await API.post('/admin/partner-policies', { ...policy, categories: selectedCategories });
      toast({ title: 'Category Policy Saved Successfully!' });
      if (selectedCategories.length === 1) fetchPolicy(selectedCategories[0]);"""
)

# Update disabled condition
content = content.replace(
    "disabled={saving || loading || !selectedCategory}",
    "disabled={saving || loading || selectedCategories.length === 0}"
)

# Update the select UI to a custom multi-select
old_select = """          <div className="min-w-[200px]">
            <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full border-2 border-emerald-100 bg-emerald-50/50 p-2.5 rounded-lg text-sm font-bold text-emerald-800 outline-none focus:border-emerald-300"
            >
                <option value="" disabled>Select a Category</option>
                {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                ))}
            </select>
          </div>"""

new_select = """          <div className="min-w-[250px] relative group cursor-pointer">
            <div className="w-full border-2 border-emerald-100 bg-emerald-50/50 p-2.5 rounded-lg text-sm font-bold text-emerald-800 outline-none focus:border-emerald-300 flex justify-between items-center">
               <span>{selectedCategories.length === 0 ? 'Select Categories' : selectedCategories.length === 1 ? categories.find(c => c._id === selectedCategories[0])?.name : `${selectedCategories.length} Categories Selected`}</span>
               <span className="text-emerald-600">▼</span>
            </div>
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block max-h-60 overflow-y-auto">
               <label className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-100">
                   <input type="checkbox" checked={selectedCategories.length === categories.length && categories.length > 0} onChange={(e) => setSelectedCategories(e.target.checked ? categories.map(c => c._id) : [])} className="rounded text-emerald-600 focus:ring-emerald-500" />
                   Select All
               </label>
               {categories.map(c => (
                   <label key={c._id} className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700">
                       <input 
                          type="checkbox" 
                          checked={selectedCategories.includes(c._id)} 
                          onChange={() => setSelectedCategories(prev => prev.includes(c._id) ? prev.filter(id => id !== c._id) : [...prev, c._id])} 
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                       />
                       {c.name}
                   </label>
               ))}
            </div>
          </div>"""

content = content.replace(old_select, new_select)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated AdminPartnerPolicies.jsx with multi-select.")
