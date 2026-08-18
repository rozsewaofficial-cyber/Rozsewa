import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, MapPin, Calendar, Clock,
  Paperclip, User, Eye, Loader2, Sparkles, FileText,
  X, Plus, Minus, Shield, Home, Info, Settings,
  ChevronRight, Check, Zap, Lock, Building, Phone,
  Mail, Hash, HelpCircle, AlertCircle, RefreshCw, Layers
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const CustomDatePicker = ({ value, onChange, min, className, placeholder = "Select Date" }) => {
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dateStr;
  };

  return (
    <div className="relative w-full group">
      {/* Visual Display Input */}
      <div className={`w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center justify-between pointer-events-none group-hover:border-emerald-400 dark:group-hover:border-emerald-600 transition-all duration-200 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Calendar className="h-4 w-4" />
          </div>
          <span className={value ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400 dark:text-slate-500"}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg">
          Change
        </span>
      </div>
      {/* Invisible Native Input */}
      <input
        type="date"
        value={value || ''}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

// ─── Indian States ─────────────────────────────────────────────────────────────
const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli", "Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const STATE_CITIES = {
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Connaught Place", "Saket", "Vasant Kunj", "Karol Bagh", "Lajpat Nagar"],
  "Uttar Pradesh": ["Noida", "Greater Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut", "Prayagraj", "Bareilly", "Aligarh"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Sonipat", "Rohtak", "Hisar", "Panchkula"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Amravati", "Navi Mumbai"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Davangere", "Ballari", "Tumakuru"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Vellore", "Erode"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Asansol", "Siliguri", "Durgapur", "Kharagpur", "Haldia"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara", "Alwar"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Rajahmundry"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot"],
  "Kerala": ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Alappuzha", "Palakkad"]
};

const getDefaultSections = () => [
  {
    id: 'sec_requirement',
    title: 'Requirement Details',
    description: 'Please describe the specific work or service you need done.',
    order: 1,
    isRepeatable: false,
    fields: [
      { id: 'requirementTitle', label: 'Requirement Title', type: 'text', required: false, placeholder: 'e.g. Need plumber for bathroom leakage repair' },
      { id: 'requirementDesc', label: 'Detailed Description', type: 'textarea', required: false, placeholder: 'Please describe details of the work required...' }
    ]
  },
  {
    id: 'sec_datetime',
    title: 'Schedule & Timing',
    description: 'When would you like the service provider to visit?',
    order: 2,
    isRepeatable: false,
    fields: [
      { id: 'preferredDate', label: 'Preferred Date', type: 'date', required: false },
      { id: 'preferredTime', label: 'Preferred Time', type: 'time', required: true }
    ]
  },
  {
    id: 'sec_address',
    title: 'Address & GPS Location',
    description: 'Select state/city, enter detailed address, and capture GPS location.',
    order: 3,
    isRepeatable: false,
    fields: [
      { id: 'state', label: 'State', type: 'dropdown', required: true },
      { id: 'city', label: 'City', type: 'text', required: true, placeholder: 'e.g. Noida' },
      { id: 'houseNo', label: 'House / Flat No.', type: 'text', required: false, placeholder: 'e.g. 104' },
      { id: 'apartment', label: 'Apartment / Building / Society', type: 'text', required: false, placeholder: 'e.g. Maple Heights' },
      { id: 'street', label: 'Street / Road Address', type: 'text', required: true, placeholder: 'e.g. Main Market Road' },
      { id: 'landmark', label: 'Landmark', type: 'text', required: false, placeholder: 'e.g. Near HDFC Bank' },
      { id: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: 'e.g. 201301' }
    ]
  },
  {
    id: 'sec_contact',
    title: 'Contact Information',
    description: 'Your details remain 100% private & masked until you choose a provider.',
    order: 4,
    isRepeatable: false,
    fields: [
      { id: 'contactName', label: 'Full Name', type: 'text', required: true },
      { id: 'contactPhone', label: 'Phone Number', type: 'phone', required: true, placeholder: '10-digit mobile number' },
      { id: 'contactEmail', label: 'Email Address (Optional)', type: 'email', required: false, placeholder: 'name@example.com (optional)' }
    ]
  }
];

// ─── Conditional Visibility Engine ────────────────────────────────────────────
const evaluateVisibility = (rules, values) => {
  if (!rules || rules.length === 0) return true;
  return rules.every(rule => {
    const depVal = values[rule.dependsOnFieldId];
    let matches = false;
    switch (rule.operator) {
      case 'equals': matches = String(depVal) === String(rule.value); break;
      case 'not_equals': matches = String(depVal) !== String(rule.value); break;
      case 'contains': matches = String(depVal || '').includes(String(rule.value)); break;
      case 'not_contains': matches = !String(depVal || '').includes(String(rule.value)); break;
      case 'gt': matches = Number(depVal) > Number(rule.value); break;
      case 'lt': matches = Number(depVal) < Number(rule.value); break;
      case 'gte': matches = Number(depVal) >= Number(rule.value); break;
      case 'lte': matches = Number(depVal) <= Number(rule.value); break;
      case 'is_empty': matches = !depVal || depVal === ''; break;
      case 'is_not_empty': matches = !!depVal && depVal !== ''; break;
      default: matches = true;
    }
    return rule.action === 'show' ? matches : !matches;
  });
};

// ─── Custom Select Component (Prevents Native Popover Displacement) ────────────
const CustomSelect = ({ value, onChange, placeholder, options = [], required, disabled, className = '' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {required && (
        <input
          type="text"
          value={value || ''}
          required
          tabIndex={-1}
          className="opacity-0 absolute inset-0 pointer-events-none w-full h-full -z-10"
          onChange={() => {}}
        />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border rounded-2xl text-sm font-semibold text-left flex items-center justify-between transition-all duration-200 shadow-sm cursor-pointer ${
          open
            ? 'border-emerald-500 bg-white dark:bg-slate-950 ring-4 ring-emerald-500/15 text-slate-900 dark:text-slate-100 shadow-md'
            : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-emerald-300 dark:hover:border-emerald-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={selectedOption ? 'text-slate-900 dark:text-slate-100 font-bold truncate' : 'text-slate-400 font-normal truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? '-rotate-90 text-emerald-600 dark:text-emerald-400' : 'rotate-90'}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-64 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-150">
          {options.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-slate-400 font-medium text-center">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300'
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-white stroke-[2.5]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Field Renderer ───────────────────────────────────────────────────────────
const FieldRenderer = ({ field, value, onChange }) => {
  const base = "w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all duration-200 shadow-sm";

  switch (field.type) {
    case 'text': case 'email': case 'phone': case 'url':
      return <input type={field.type === 'phone' ? 'tel' : field.type === 'currency' ? 'number' : field.type} className={base} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'textarea':
      return <textarea rows={4} className={`${base} resize-none leading-relaxed`} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'number': case 'currency':
      return (
        <div className="relative">
          {field.type === 'currency' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹</span>}
          <input type="number" className={`${base} ${field.type === 'currency' ? 'pl-8' : ''}`} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      );

    case 'dropdown':
      return (
        <CustomSelect
          value={value || ''}
          onChange={onChange}
          placeholder={`— ${field.placeholder || 'Select Option'} —`}
          options={(field.options || []).map(o => ({ value: o.value, label: o.label }))}
        />
      );

    case 'radio':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(field.options || []).map(o => {
            const checked = value === o.value;
            return (
              <label key={o.value} className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 ${checked ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-emerald-300 dark:hover:border-emerald-700'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${checked ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-700'}`}>
                  {checked && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-semibold">{o.label}</span>
                <input type="radio" name={field.id} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              </label>
            );
          })}
        </div>
      );

    case 'checkbox': case 'boolean':
      return (
        <label className="flex items-center justify-between p-4 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-emerald-400 transition-colors">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{field.label || 'Enable option'}</span>
          <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-800'}`} onClick={() => onChange(!value)}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${value ? 'left-7' : 'left-1'}`} />
          </div>
        </label>
      );

    case 'multi_select':
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(field.options || []).map(o => {
            const checked = selected.includes(o.value);
            return (
              <label key={o.value} className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 ${checked ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-emerald-300 dark:hover:border-emerald-700'}`}>
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-700'}`}>
                  {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </div>
                <span className="text-sm font-semibold">{o.label}</span>
                <input type="checkbox" checked={checked} className="sr-only" onChange={e => {
                  const newVal = e.target.checked ? [...selected, o.value] : selected.filter(v => v !== o.value);
                  onChange(newVal);
                }} />
              </label>
            );
          })}
        </div>
      );

    case 'date':
      return <CustomDatePicker value={value || ''} onChange={onChange} min={new Date().toISOString().split('T')[0]} />;

    case 'time':
      return <input type="time" className={base} value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'datetime':
      return <input type="datetime-local" className={base} value={value || ''} onChange={e => onChange(e.target.value)} min={new Date().toISOString().slice(0, 16)} />;

    case 'gps':
      return (
        <div className="flex gap-2 items-center">
          <div className="flex-1 px-4 py-3 bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
            {value ? `${value.lat?.toFixed(5)}, ${value.lng?.toFixed(5)}` : 'No location captured'}
          </div>
          <button type="button" onClick={() => {
            navigator.geolocation?.getCurrentPosition(p => onChange({ lat: p.coords.latitude, lng: p.coords.longitude }));
          }} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95">
            <MapPin className="h-3.5 w-3.5" /> Capture GPS
          </button>
        </div>
      );

    default: return <input type="text" className={base} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
};

// ─── Section Renderer ──────────────────────────────────────────────────────────
const SectionRenderer = ({ section, formValues, onFieldChange, renderField }) => {
  const [repeatCount, setRepeatCount] = useState(1);
  const visible = evaluateVisibility([], formValues);
  if (!visible) return null;

  const renderFields = (suffix = '') => (
    section.fields.map(field => {
      const fieldId = suffix ? `${field.id}__${suffix}` : field.id;
      const isVisible = evaluateVisibility(field.visibilityRules, formValues);
      if (!isVisible) return null;
      return (
        <div key={fieldId} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              {field.label}
              {field.required && !['requirementTitle', 'requirementDesc'].includes(field.id) && <span className="text-rose-500 font-bold">*</span>}
            </label>
          </div>
          {field.helpText && <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{field.helpText}</p>}
          {renderField(field, suffix)}
        </div>
      );
    })
  );

  return (
    <div className="space-y-4">
      {section.isRepeatable ? (
        <div className="space-y-4">
          {Array.from({ length: repeatCount }).map((_, i) => (
            <div key={i} className="p-4 bg-slate-50/80 dark:bg-slate-950/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-4">
              {repeatCount > 1 && (
                <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Entry #{i + 1}</span>
                </div>
              )}
              {renderFields(i > 0 ? `repeat_${i}` : '')}
            </div>
          ))}
          <div className="flex gap-2">
            {repeatCount < (section.maxRepeat || 5) && (
              <button type="button" onClick={() => setRepeatCount(c => c + 1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Another Entry
              </button>
            )}
            {repeatCount > 1 && (
              <button type="button" onClick={() => setRepeatCount(c => c - 1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors">
                <Minus className="h-3.5 w-3.5" /> Remove Entry
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">{renderFields()}</div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const LeadRequirementForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const initialCategoryId = searchParams.get("category") || "";

  // State values
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [subServices, setSubServices] = useState([]);
  const [loadingSubServices, setLoadingSubServices] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const draftTimer = useRef(null);

  // Clear subcategory & service ID when category changes, and fetch active subcategories
  useEffect(() => {
    setSelectedSubcategoryId("");
    setSelectedServiceId("");
    setSubcategories([]);

    if (!selectedCategoryId) return;

    const fetchSubcategories = async () => {
      setLoadingSubcategories(true);
      try {
        const { data } = await API.get(`/public/categories/${selectedCategoryId}/subcategories`);
        console.log("[LeadRequirementForm] Subcategories fetched:", data);
        if (Array.isArray(data) && data.length > 0) {
          setSubcategories(data);
        } else {
          const catObj = categories.find(c => c._id === selectedCategoryId);
          if (catObj?.subCategories && Array.isArray(catObj.subCategories) && catObj.subCategories.length > 0) {
            const mappedSubs = catObj.subCategories.map((sc, idx) => (
              typeof sc === 'string' ? { _id: `sub_${idx}`, name: sc } : sc
            ));
            setSubcategories(mappedSubs);
          } else {
            setSubcategories([]);
          }
        }
      } catch (err) {
        console.error("[LeadRequirementForm] Failed to fetch subcategories:", err);
        const catObj = categories.find(c => c._id === selectedCategoryId);
        if (catObj?.subCategories && Array.isArray(catObj.subCategories) && catObj.subCategories.length > 0) {
          const mappedSubs = catObj.subCategories.map((sc, idx) => (
            typeof sc === 'string' ? { _id: `sub_${idx}`, name: sc } : sc
          ));
          setSubcategories(mappedSubs);
        } else {
          setSubcategories([]);
        }
      } finally {
        setLoadingSubcategories(false);
      }
    };

    fetchSubcategories();
  }, [selectedCategoryId, categories]);

  // Fetch real services tied to the selected subcategory (lead categories price
  // the lead itself, so zero-priced services must still be included).
  useEffect(() => {
    setSelectedServiceId("");
    setSubServices([]);

    if (!selectedSubcategoryId) return;

    const fetchSubServices = async () => {
      setLoadingSubServices(true);
      try {
        const { data } = await API.get(`/public/subcategories/${selectedSubcategoryId}/services`, {
          params: { includeZeroPrice: 'true', categoryId: selectedCategoryId }
        });
        setSubServices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[LeadRequirementForm] Failed to fetch sub-services:", err);
        setSubServices([]);
      } finally {
        setLoadingSubServices(false);
      }
    };

    fetchSubServices();
  }, [selectedSubcategoryId, selectedCategoryId]);

  // Scroll to top on mount or when category/service changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedCategoryId, selectedSubcategoryId, selectedServiceId]);

  // Form schema
  const [formSchema, setFormSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [formId, setFormId] = useState(null);
  const [formVersion, setFormVersion] = useState(null);

  // Core Form Fields
  const [requirementTitle, setRequirementTitle] = useState('');
  const [requirementDesc, setRequirementDesc] = useState('');
  const [dynamicValues, setDynamicValues] = useState({});
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [selectedMin, setSelectedMin] = useState('');
  const [timeSlotFilter, setTimeSlotFilter] = useState('all');
  const [isDateFlexible, setIsDateFlexible] = useState(false);
  const [isTimeFlexible, setIsTimeFlexible] = useState(false);

  // Synchronize Hour & Minute select with preferredTime state
  useEffect(() => {
    if (selectedHour && selectedMin) {
      setPreferredTime(`${selectedHour}:${selectedMin}`);
    } else {
      setPreferredTime('');
    }
  }, [selectedHour, selectedMin]);

  // Reset invalid past hour/minute if date changes or time ticks
  useEffect(() => {
    if (!preferredDate) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const currentTodayStr = `${yyyy}-${mm}-${dd}`;

    if (preferredDate === currentTodayStr) {
      const currentHour = today.getHours();
      const currentMin = today.getMinutes();
      if (selectedHour) {
        const hNum = Number(selectedHour);
        if (hNum < currentHour || (hNum === currentHour && currentMin >= 45)) {
          setSelectedHour('');
          setSelectedMin('');
        } else if (hNum === currentHour && selectedMin) {
          if (Number(selectedMin) <= currentMin) {
            setSelectedMin('');
          }
        }
      }
    }
  }, [preferredDate, selectedHour, selectedMin]);

  // Location Fields
  const [coordinates, setCoordinates] = useState(null);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [locationDetail, setLocationDetail] = useState({
    houseNo: '', apartment: '', street: '', landmark: '', area: '', city: '', state: '', pincode: ''
  });

  // Contact Details
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState(user?.mobile || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');

  // Dynamic calculate completion progress percentage
  const calculateProgress = () => {
    let completedSteps = 0;
    let totalSteps = 5;

    if (selectedCategoryId) completedSteps += 1;
    if (requirementTitle.length >= 10 && requirementDesc.length >= 15) completedSteps += 1;
    if (preferredTime) completedSteps += 1;
    if (locationDetail.state && locationDetail.city && locationDetail.street && locationDetail.pincode && coordinates) completedSteps += 1;
    if (contactName && contactPhone && contactPhone.length === 10) completedSteps += 1;

    return Math.min(100, Math.round((completedSteps / totalSteps) * 100));
  };

  const renderField = (field, suffix = '') => {
    const fieldId = suffix ? `${field.id}__${suffix}` : field.id;

    switch (field.id) {
      case 'requirementTitle':
        return (
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="text" required={false} value={requirementTitle} onChange={e => setRequirementTitle(e.target.value)}
                placeholder={field.placeholder || "e.g. Need plumber for bathroom leakage repair"}
                className="w-full px-4 pr-24 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all duration-200 shadow-sm"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${requirementTitle.length >= 10 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {requirementTitle.length}/10 min
                </span>
              </div>
            </div>
          </div>
        );
      case 'requirementDesc':
        return (
          <div className="space-y-1.5">
            <div className="relative">
              <textarea
                rows={4} required={false} value={requirementDesc} onChange={e => setRequirementDesc(e.target.value)}
                placeholder={field.placeholder || "Please describe details of the work required..."}
                className="w-full px-4 pr-24 pb-9 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all duration-200 resize-none leading-relaxed shadow-sm"
              />
              <div className="absolute right-3.5 bottom-3.5 pointer-events-none">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${requirementDesc.length >= 15 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {requirementDesc.length}/15 min
                </span>
              </div>
            </div>
          </div>
        );

      case 'preferredDate':
        return (
          <CustomDatePicker
            value={preferredDate}
            onChange={setPreferredDate}
            min={(() => {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            })()}
          />
        );

      case 'preferredTime':
        const todayStr = (() => {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        })();

        const TIME_SLOTS = [
          { id: 'morning', label: 'Morning', sublabel: '6 AM - 12 PM', hourRange: [6, 7, 8, 9, 10, 11], defaultHour: '09', icon: '🌅' },
          { id: 'afternoon', label: 'Afternoon', sublabel: '12 PM - 4 PM', hourRange: [12, 13, 14, 15], defaultHour: '13', icon: '☀️' },
          { id: 'evening', label: 'Evening', sublabel: '4 PM - 8 PM', hourRange: [16, 17, 18, 19], defaultHour: '17', icon: '🌆' },
          { id: 'night', label: 'Night', sublabel: '8 PM - 12 AM', hourRange: [20, 21, 22, 23], defaultHour: '20', icon: '🌙' },
        ];

        // Determine currently active slot ID based on selectedHour or timeSlotFilter
        const activeSlotId = (() => {
          if (selectedHour !== '') {
            const hNum = Number(selectedHour);
            const found = TIME_SLOTS.find(s => s.hourRange.includes(hNum));
            if (found) return found.id;
          }
          return timeSlotFilter !== 'all' ? timeSlotFilter : null;
        })();

        // Hours to display in dropdown based on active slot filter
        const displayedHours = (() => {
          if (timeSlotFilter && timeSlotFilter !== 'all') {
            const activeSlot = TIME_SLOTS.find(s => s.id === timeSlotFilter);
            if (activeSlot) return activeSlot.hourRange;
          }
          return Array.from({ length: 24 }, (_, i) => i);
        })();

        const handleSlotClick = (slot) => {
          setTimeSlotFilter(slot.id);
          let targetHour = slot.defaultHour;

          if (preferredDate && preferredDate === todayStr) {
            const currentHour = new Date().getHours();
            const currentMin = new Date().getMinutes();
            const validHour = slot.hourRange.find(h => h > currentHour || (h === currentHour && currentMin < 45));

            if (validHour !== undefined) {
              targetHour = String(validHour).padStart(2, '0');
            } else {
              toast({
                title: `${slot.label} slots passed for today`,
                description: `Please choose an upcoming time slot or change the date.`
              });
              return;
            }
          }

          setSelectedHour(targetHour);
          setSelectedMin('00');
        };

        return (
          <div className="space-y-3">
            {/* Slot Filter Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map(slot => {
                const isSelected = activeSlotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => handleSlotClick(slot)}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30' : 'bg-slate-50/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{slot.icon}</span>
                      <span>{slot.label}</span>
                    </div>
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {slot.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hour/Min Selectors */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <select
                  required={field.required}
                  value={selectedHour}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedHour(val);
                    if (val) {
                      if (!selectedMin) setSelectedMin('00');
                      const hNum = Number(val);
                      const matchingSlot = TIME_SLOTS.find(s => s.hourRange.includes(hNum));
                      if (matchingSlot) {
                        setTimeSlotFilter(matchingSlot.id);
                      }
                    }
                  }}
                  className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select Hour</option>
                  {displayedHours.map(i => {
                    const h = String(i).padStart(2, '0');
                    const period = i >= 12 ? 'PM' : 'AM';
                    const display12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                    const formatted12 = `${display12} ${period}`;
                    const disabled = (() => {
                      if (preferredDate && preferredDate === todayStr) {
                        const currentHour = new Date().getHours();
                        const currentMin = new Date().getMinutes();
                        if (i < currentHour) return true;
                        if (i === currentHour && currentMin >= 45) return true;
                      }
                      return false;
                    })();
                    return <option key={h} value={h} disabled={disabled}>{h}:00 ({formatted12})</option>;
                  })}
                </select>
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  required={field.required}
                  value={selectedMin}
                  onChange={e => setSelectedMin(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select Minute</option>
                  {['00', '15', '30', '45'].map(m => {
                    const disabled = (() => {
                      if (preferredDate && preferredDate === todayStr && selectedHour) {
                        const currentHour = new Date().getHours();
                        const currentMin = new Date().getMinutes();
                        if (Number(selectedHour) === currentHour && Number(m) <= currentMin) {
                          return true;
                        }
                      }
                      return false;
                    })();
                    return <option key={m} value={m} disabled={disabled}>{m} mins</option>;
                  })}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rotate-90 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Filter Toggle Reset Pill */}
            {timeSlotFilter !== 'all' && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-bold text-slate-500">
                  Filtered by {TIME_SLOTS.find(s => s.id === timeSlotFilter)?.label} ({TIME_SLOTS.find(s => s.id === timeSlotFilter)?.sublabel})
                </span>
                <button
                  type="button"
                  onClick={() => setTimeSlotFilter('all')}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Show All 24 Hours
                </button>
              </div>
            )}
          </div>
        );

      case 'state':
        return (
          <CustomSelect
            required={field.required}
            value={locationDetail.state}
            onChange={val => setLocationDetail(prev => ({ ...prev, state: val }))}
            placeholder="Select State"
            options={STATES.map(s => ({ value: s, label: s }))}
          />
        );

      case 'city':
        return (
          <div className="relative w-full">
            <input type="text" required={field.required} value={locationDetail.city} placeholder={field.placeholder || "e.g. Noida"}
              onChange={e => {
                setLocationDetail(prev => ({ ...prev, city: e.target.value.replace(/[^\p{L}\p{M}\s]/gu, '') }));
                document.getElementById('city-dropdown')?.classList.remove('hidden');
              }}
              onFocus={() => document.getElementById('city-dropdown')?.classList.remove('hidden')}
              onBlur={() => setTimeout(() => document.getElementById('city-dropdown')?.classList.add('hidden'), 200)}
              onKeyDown={(e) => {
                if (/[^a-zA-Z\s]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault();
                }
              }}
              pattern="^[\p{L}\p{M}\s]+$"
              title="City should not accept special characters and numbers"
              className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />

            <div id="city-dropdown" className="hidden absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-48 overflow-y-auto top-full left-0 p-1">
              {(STATE_CITIES[locationDetail.state] || [])
                .filter(c => c.toLowerCase().includes((locationDetail.city || '').toLowerCase()))
                .map(city => (
                  <div key={city} onClick={() => setLocationDetail(prev => ({ ...prev, city }))} className="px-4 py-2.5 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors">
                    {city}
                  </div>
                ))}
              {(STATE_CITIES[locationDetail.state] || []).filter(c => c.toLowerCase().includes((locationDetail.city || '').toLowerCase())).length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center font-medium">No city matches found</div>
              )}
            </div>
          </div>
        );

      case 'houseNo':
        return (
          <input type="text" value={locationDetail.houseNo || ''} placeholder={field.placeholder || "e.g. Flat 104, Block A"}
            onChange={e => setLocationDetail(prev => ({ ...prev, houseNo: e.target.value.replace(/[^\p{L}\p{N}\s,.-]/gu, '') }))}
            onKeyDown={(e) => {
              if (/[^\p{L}\p{N}\s,.-]/u.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{N}\s,.-]*$"
            title="Special characters are not allowed"
            className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
        );
      case 'apartment':
        return (
          <input type="text" value={locationDetail.apartment || ''} placeholder={field.placeholder || "e.g. Maple Heights"}
            onChange={e => setLocationDetail(prev => ({ ...prev, apartment: e.target.value.replace(/[^\p{L}\p{N}\s,.-]/gu, '') }))}
            onKeyDown={(e) => {
              if (/[^\p{L}\p{N}\s,.-]/u.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{N}\s,.-]*$"
            title="Special characters are not allowed"
            className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
        );
      case 'street':
        return (
          <input type="text" required={field.required} value={locationDetail.street || ''} placeholder={field.placeholder || "e.g. Main Market Road"}
            onChange={e => setLocationDetail(prev => ({ ...prev, street: e.target.value.replace(/[^\p{L}\p{N}\s,.-]/gu, '') }))}
            onKeyDown={(e) => {
              if (/[^\p{L}\p{N}\s,.-]/u.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{N}\s,.-]*$"
            title="Special characters are not allowed"
            className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
        );
      case 'landmark':
        return (
          <input type="text" value={locationDetail.landmark || ''} placeholder={field.placeholder || "e.g. Near HDFC Bank"}
            onChange={e => setLocationDetail(prev => ({ ...prev, landmark: e.target.value.replace(/[^\p{L}\p{N}\s,.-]/gu, '') }))}
            onKeyDown={(e) => {
              if (/[^\p{L}\p{N}\s,.-]/u.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{N}\s,.-]*$"
            title="Special characters are not allowed"
            className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
        );
      case 'pincode':
        return (
          <input type="text" inputMode="numeric" required={field.required} value={locationDetail.pincode || ''} placeholder={field.placeholder || "e.g. 201301"}
            maxLength={6}
            onChange={e => setLocationDetail(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            onKeyDown={(e) => {
              if (!/[0-9]/.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="[0-9]{6}"
            title="Pincode must be exactly 6 digits"
            className="w-full px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
        );

      case 'contactName':
        return (
          <div className="relative">
            <input type="text" required={field.required} value={contactName}
              onChange={e => setContactName(e.target.value.replace(/[^\p{L}\p{M}\s]/gu, ''))}
              onKeyDown={(e) => {
                if (/[^a-zA-Z\s]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault();
                }
              }}
              pattern="^[\p{L}\p{M}\s]+$"
              title="Contact name should not accept special characters and numbers"
              className="w-full px-4 py-3.5 pl-11 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
          </div>
        );
      case 'contactPhone':
        return (
          <div className="relative">
            <input type="tel" required={field.required} value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={field.placeholder || "10-digit mobile number"}
              className="w-full px-4 py-3.5 pl-11 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
          </div>
        );
      case 'contactEmail':
        return (
          <div className="relative">
            <input type="email" required={field.required} value={contactEmail}
              placeholder={field.placeholder || "name@example.com (optional)"}
              onChange={e => setContactEmail(e.target.value.toLowerCase())}
              onKeyDown={(e) => {
                if (/[A-Z]/.test(e.key) && e.key.length === 1) {
                  e.preventDefault();
                }
              }}
              pattern="^[^A-Z]*$"
              title="Email address should not contain capital letters"
              className="w-full px-4 py-3.5 pl-11 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all" />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
          </div>
        );

      default:
        return (
          <FieldRenderer
            field={field}
            value={dynamicValues[fieldId]}
            onChange={val => setDynamicValues(prev => ({ ...prev, [fieldId]: val }))}
          />
        );
    }
  };

  // ── Fetch Categories ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      console.log("[LeadRequirementForm] Initiating categories API fetch...");
      try {
        const { data } = await API.get("/public/categories");
        console.log("[LeadRequirementForm] Categories fetched raw data:", data);
        const leadCats = (data || []).filter(c => c.isActive && c.businessModel === 'lead');
        console.log("[LeadRequirementForm] Filtered lead categories:", leadCats);
        setCategories(leadCats);
        if (!selectedCategoryId && leadCats.length > 0) {
          console.log("[LeadRequirementForm] Auto-selecting initial category:", leadCats[0]._id);
          setSelectedCategoryId(leadCats[0]._id);
        }
      } catch (err) {
        console.error("[LeadRequirementForm] Failed to fetch categories error:", err);
      }
    };
    fetchCategories();
  }, []);

  // ── Fetch Schema & Restore Draft ─────────────────────────────────────────────
  useEffect(() => {
    const fetchSchema = async () => {
      if (!selectedCategoryId) {
        console.log("[LeadRequirementForm] No selectedCategoryId, skipping schema fetch.");
        return;
      }
      console.log(`[LeadRequirementForm] Starting schema fetch for category ${selectedCategoryId}, service: ${selectedServiceId || 'none'}`);
      setSchemaLoading(true);
      try {
        const queryParams = selectedServiceId ? `?serviceId=${selectedServiceId}` : '';
        const url = `/leads/forms/${selectedCategoryId}${queryParams}`;
        console.log(`[LeadRequirementForm] API GET Request: ${url}`);
        const { data } = await API.get(url);
        console.log("[LeadRequirementForm] Schema fetched successfully:", data);
        setFormSchema(data);
        setFormId(data.formId);
        setFormVersion(data.formVersion);
        setDynamicValues({});

        // Restore draft if any for this category
        const urlDraftId = searchParams.get('draftId');
        let activeDraftId = null;
        if (urlDraftId) {
          activeDraftId = urlDraftId;
          setDraftId(urlDraftId);
          console.log(`[LeadRequirementForm] Using draft ID from URL: ${urlDraftId}`);
        } else {
          const cachedDraft = localStorage.getItem(`lead_draft_id_${selectedCategoryId}`);
          activeDraftId = cachedDraft || null;
          setDraftId(activeDraftId);
          console.log(`[LeadRequirementForm] Restored draft ID from cache: ${cachedDraft || 'none'}`);
        }

        if (activeDraftId) {
          try {
            console.log(`[LeadRequirementForm] Fetching draft details for: ${activeDraftId}`);
            const draftRes = await API.get(`/leads/${activeDraftId}`);
            const draftData = draftRes.data;
            if (draftData.subcategoryId) setSelectedSubcategoryId(draftData.subcategoryId);
            if (draftData.requirementTitle) setRequirementTitle(draftData.requirementTitle);
            if (draftData.requirementDesc) setRequirementDesc(draftData.requirementDesc);
            if (draftData.locationDetail) {
              setLocationDetail({
                houseNo: draftData.locationDetail.houseNo || '',
                apartment: draftData.locationDetail.apartment || '',
                street: draftData.locationDetail.street || '',
                landmark: draftData.locationDetail.landmark || '',
                area: draftData.locationDetail.area || '',
                city: draftData.locationDetail.city || '',
                state: draftData.locationDetail.state || '',
                pincode: draftData.locationDetail.pincode || ''
              });
            }
            if (draftData.dynamicAnswers && draftData.dynamicAnswers.length > 0) {
              const mapped = {};
              draftData.dynamicAnswers.forEach(ans => { mapped[ans.fieldId] = ans.value; });
              setDynamicValues(mapped);
            }
            if (draftData.preferredDate) {
              setPreferredDate(new Date(draftData.preferredDate).toISOString().split('T')[0]);
            }
            if (draftData.preferredTime) {
              setPreferredTime(draftData.preferredTime);
              const [h, m] = draftData.preferredTime.split(':');
              setSelectedHour(h || '');
              setSelectedMin(m || '');
            }
          } catch (draftErr) {
            console.error("[LeadRequirementForm] Failed to fetch draft details:", draftErr);
          }
        } else {
          // Reset form fields to empty since there is no active draft for this category
          setRequirementTitle('');
          setRequirementDesc('');
          setLocationDetail({
            houseNo: '',
            apartment: '',
            street: '',
            landmark: '',
            area: '',
            city: '',
            state: '',
            pincode: ''
          });
          setPreferredDate('');
          setPreferredTime('');
          setSelectedHour('');
          setSelectedMin('');
        }
      } catch (err) {
        console.error("[LeadRequirementForm] Failed to fetch form schema:", err);
        setFormSchema({ sections: [] });
      } finally {
        setSchemaLoading(false);
        console.log("[LeadRequirementForm] Schema load sequence completed.");
      }
    };
    fetchSchema();
  }, [selectedCategoryId, selectedServiceId]);

  // ── GPS setup on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const cachedLocStr = sessionStorage.getItem("rozsewa_user_location") || localStorage.getItem("rozsewa_user_location");
    if (cachedLocStr) {
      try {
        const cachedLoc = JSON.parse(cachedLocStr);
        if (cachedLoc && cachedLoc.lat && cachedLoc.lng) {
          setCoordinates([cachedLoc.lng, cachedLoc.lat]);
          return;
        }
      } catch (e) {}
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCoordinates([pos.coords.longitude, pos.coords.latitude]);
          sessionStorage.setItem("rozsewa_user_location", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
        },
        () => setCoordinates([77.209, 28.613])
      );
    }
  }, []);

  // ── Contact auto-fill ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setContactName(user.name || '');
      setContactPhone(user.mobile || user.phone || '');
      setContactEmail(user.email || '');
    }
  }, [user]);

  // ── Autosave draft (debounced 3s) ─────────────────────────────────────────────
  const persistDraft = async () => {
    if (!selectedCategoryId) return;
    setSavingDraft(true);
    try {
      const body = buildPayload('draft');
      if (draftId) {
        await API.put(`/leads/draft/${draftId}`, { ...body });
      } else {
        const { data } = await API.post('/leads/draft', body);
        setDraftId(data.draftId);
        localStorage.setItem(`lead_draft_id_${selectedCategoryId}`, data.draftId);
      }
    } catch { /* ignore silently */ }
    finally { setSavingDraft(false); }
  };

  useEffect(() => {
    if (!requirementTitle && !requirementDesc) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => persistDraft(), 3000);
    return () => clearTimeout(draftTimer.current);
  }, [requirementTitle, requirementDesc, dynamicValues, locationDetail, preferredDate, preferredTime]);

  const buildDynamicAnswers = () => {
    if (!formSchema?.sections) return [];
    const answers = [];
    formSchema.sections.forEach(section => {
      section.fields.forEach(field => {
        const val = dynamicValues[field.id];
        if (val !== undefined && val !== null && val !== '') {
          answers.push({ fieldId: field.id, label: field.label, fieldType: field.type, value: val });
        }
      });
    });
    return answers;
  };

  const buildPayload = (mode = 'submit') => ({
    categoryId: selectedCategoryId,
    subcategoryId: selectedSubcategoryId || null,
    serviceId: selectedServiceId || null,
    subServiceId: selectedServiceId || null,
    formId,
    formVersion,
    requirementTitle,
    requirementDesc,
    dynamicAnswers: buildDynamicAnswers(),
    preferredDate,
    preferredTime,
    isDateFlexible,
    isTimeFlexible,
    location: coordinates ? { type: 'Point', coordinates } : undefined,
    locationDetail,
    attachments: [],
    draftId: mode === 'submit' ? draftId : undefined
  });

  const parseGeocodeAddress = (components) => {
    let state = '';
    let city = '';
    let pincode = '';
    let street = '';
    let area = '';
    let houseNo = '';

    components.forEach(comp => {
      const types = comp.types;
      if (types.includes('administrative_area_level_1')) {
        state = comp.long_name;
      }
      if (types.includes('locality')) {
        city = comp.long_name;
      } else if (!city && types.includes('administrative_area_level_2')) {
        city = comp.long_name;
      }
      if (types.includes('postal_code')) {
        pincode = comp.long_name;
      }
      if (types.includes('route') || types.includes('street_address')) {
        street = comp.long_name;
      }
      if (types.includes('sublocality') || types.includes('neighborhood') || types.includes('sublocality_level_1')) {
        area = comp.long_name;
      }
      if (types.includes('street_number') || types.includes('subpremise') || types.includes('premise')) {
        houseNo = comp.long_name;
      }
    });

    return { state, city, pincode, street, area, houseNo };
  };

  const reverseGeocode = async (lng, lat) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const components = data.results[0].address_components;
        const parsed = parseGeocodeAddress(components);
        const fullFormattedAddress = data.results[0].formatted_address || '';

        const matchedState = STATES.find(s =>
          s.toLowerCase().replace(/[^a-z]/g, '') === parsed.state.toLowerCase().replace(/[^a-z]/g, '')
        ) || '';

        setLocationDetail(prev => ({
          ...prev,
          state: matchedState || prev.state,
          city: parsed.city || prev.city,
          pincode: parsed.pincode || prev.pincode,
          houseNo: prev.houseNo || parsed.houseNo || '',
          street: fullFormattedAddress || parsed.street || prev.street,
          area: parsed.area || prev.area
        }));
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
  };

  // Reverse geocode whenever GPS coordinates change
  useEffect(() => {
    if (coordinates) {
      reverseGeocode(coordinates[0], coordinates[1]);
    }
  }, [coordinates]);

  const captureGPS = () => {
    setGettingGPS(true);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setCoordinates([pos.coords.longitude, pos.coords.latitude]);
        setGettingGPS(false);
        toast({ title: 'GPS Location Locked', description: 'Address updated based on your coordinates.' });
      },
      () => {
        toast({ title: 'GPS Location unavailable', variant: 'destructive' });
        setGettingGPS(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requirementTitle && requirementTitle.length < 10) {
      toast({ title: 'Requirement title too short', description: 'Minimum length is 10 characters.', variant: 'destructive' });
      return;
    }
    if (requirementDesc && requirementDesc.length < 15) {
      toast({ title: 'Description too short', description: 'Please provide at least 15 characters describing what you need.', variant: 'destructive' });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(contactPhone)) {
      toast({ title: 'Invalid Phone Number', description: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.', variant: 'destructive' });
      return;
    }
    if (!coordinates) {
      toast({ title: 'Location coordinate capture is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await API.post('/leads', buildPayload('submit'));
      if (draftId) {
        localStorage.removeItem(`lead_draft_id_${selectedCategoryId}`);
      }
      setSubmitted(true);
    } catch (err) {
      toast({ title: 'Submission Failed', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = calculateProgress();

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070C18] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="h-12 w-12 text-white stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="px-3.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              Request Posted Successfully
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Requirement Broadcasted!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Your request has been matched with verified service providers in your area. Providers will contact you shortly with custom quotes.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Request Category</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {categories.find(c => c._id === selectedCategoryId)?.name || 'Service Request'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Title</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {requirementTitle || 'General Service Request'}
              </span>
            </div>
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Zero advance payment or booking fees</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Contact details protected by privacy shield</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button onClick={() => navigate('/my-leads')}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98]">
              View My Active Requests
            </button>
            <button onClick={() => navigate('/home')}
              className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
              <Home className="h-4 w-4" /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REDESIGNED MAIN FORM
  // ═══════════════════════════════════════════════════════════════════════════
  const activeCategory = categories.find(c => c._id === selectedCategoryId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070C18] text-slate-900 dark:text-slate-100 pb-36 font-sans">

      {/* Top Glassmorphic Navigation & Progress Bar */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-[#070C18]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-all">
        {/* Dynamic Completion Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
          <div
            className="bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" /> Lead Request
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {progressPercent}% Complete
                </span>
              </div>
              <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">Create Service Request</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {savingDraft ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[11px] font-bold border border-amber-200/50">
                <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                <span>Auto-Saving</span>
              </div>
            ) : draftId ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200/50">
                <Check className="h-3 w-3" />
                <span>Draft Saved</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pt-4 space-y-5 md:space-y-6">

        {/* Hero Banner Header - Sleek Compact Emerald Green & Amber Palette */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 rounded-3xl p-5 md:p-6 text-white shadow-xl shadow-emerald-700/15">
          <div className="relative z-10 space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold border border-white/20">
              <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
              <span>Fast Verified Provider Matching</span>
            </div>
            <h2 className="text-lg md:text-xl font-black tracking-tight leading-snug">
              Tell us what you need, get offers from local experts.
            </h2>
            <div className="flex flex-wrap items-center gap-3.5 text-xs font-medium text-emerald-100 pt-0.5">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-300" />
                <span>100% Masked Privacy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" />
                <span>Verified Experts Only</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                <span>Flexible Schedules</span>
              </div>
            </div>
          </div>
          {/* Subtle background glow circle decor */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* STEP 1: SERVICE CATEGORY & SUBCATEGORY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs md:text-sm shrink-0 border border-emerald-200/50 dark:border-emerald-800/40 shadow-sm">
                01
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Service Category</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose the category for your request</p>
              </div>
            </div>
            {selectedCategoryId && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Service Category *
              </label>
              <CustomSelect
                required
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                placeholder="— Select a Service Category —"
                options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
              />
            </div>

            {/* Responsive Subcategory Dropdown Block */}
            {loadingSubcategories ? (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                <span>Loading available subcategories...</span>
              </div>
            ) : subcategories.length > 0 ? (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Service Subcategory *
                  </label>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                    {subcategories.length} Options
                  </span>
                </div>

                <CustomSelect
                  required
                  value={selectedSubcategoryId}
                  onChange={setSelectedSubcategoryId}
                  placeholder="— Select Subcategory —"
                  options={subcategories.map(sub => ({ value: sub._id || sub.name, label: sub.name }))}
                />
              </div>
            ) : null}

            {/* Sub-services picker if the selected subcategory has services */}
            {loadingSubServices ? (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                <span>Loading available services...</span>
              </div>
            ) : subServices.length > 0 ? (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Specific Sub-Service *
                </label>
                <CustomSelect
                  required
                  value={selectedServiceId}
                  onChange={setSelectedServiceId}
                  placeholder="— Select Specific Sub-Service —"
                  options={subServices.map(srv => ({ value: srv._id, label: srv.name }))}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* DYNAMIC SECTIONS & DEFAULT SECTIONS */}
        {(formSchema?.sections?.length > 0 ? formSchema.sections : getDefaultSections()).map((section, idx) => {
          const stepNum = String(idx + 2).padStart(2, '0');
          return (
            <div key={section.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
              
              {/* Section Header with Step Pill */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs md:text-sm shrink-0 border border-emerald-200/50 dark:border-emerald-800/40 shadow-sm">
                    {stepNum}
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{section.title}</h3>
                    {section.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{section.description}</p>
                    )}
                  </div>
                </div>
                {section.id === 'sec_requirement' && requirementTitle.length >= 10 && requirementDesc.length >= 15 && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                {section.id === 'sec_datetime' && preferredTime && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                {section.id === 'sec_address' && coordinates && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                {section.id === 'sec_contact' && contactName && contactPhone.length === 10 && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>

              {/* Section Content Fields */}
              <SectionRenderer
                section={section}
                formValues={dynamicValues}
                onFieldChange={(fieldId, val) => setDynamicValues(prev => ({ ...prev, [fieldId]: val }))}
                renderField={renderField}
              />

              {/* Embedded GPS & Interactive Map inside Address Section */}
              {section.id === 'sec_address' && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={captureGPS}
                      disabled={gettingGPS}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60"
                    >
                      {gettingGPS ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : (
                        <div className="relative">
                          <MapPin className="h-4 w-4 text-white" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        </div>
                      )}
                      <span>{gettingGPS ? 'Capturing Precise GPS...' : coordinates ? 'Update GPS Location' : 'Lock GPS Location *'}</span>
                    </button>
                    {coordinates && (
                      <div className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-3 rounded-2xl border border-emerald-200/50 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>Coordinates Captured</span>
                      </div>
                    )}
                  </div>

                  {coordinates && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                      <iframe
                        title="map-frame"
                        className="w-full h-44 rounded-2xl"
                        src={`https://maps.google.com/maps?q=${coordinates[1]},${coordinates[0]}&z=15&output=embed`}
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Privacy Shield Reassurance Banner in Contact Section */}
              {section.id === 'sec_contact' && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-amber-950/30 border border-emerald-200/60 dark:border-emerald-900/50 rounded-2xl flex items-start gap-3 mt-4">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200">100% Privacy Protection Shield</h4>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                      Your address and phone number remain completely masked. Verified service providers can only view your general requirement until you explicitly accept a quote.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

      </form>

      {/* Floating Bottom Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#070C18]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 p-4 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="hidden sm:block flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
              <span>Form Progress</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 sm:flex-initial sm:px-10 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>Submit Lead Request</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default LeadRequirementForm;
