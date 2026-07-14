import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, MapPin, Calendar, Clock,
  Paperclip, User, Eye, Loader2, Sparkles, FileText,
  X, Plus, Minus, Shield, Home, Info, Settings
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import TopNav from "@/modules/user/components/TopNav";
import API from "@/lib/api";

const CustomDatePicker = ({ value, onChange, min, className, placeholder = "Select Date" }) => {
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="relative w-full">
      {/* Visual Display Input */}
      <div className={`w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center justify-between pointer-events-none ${className}`}>
        <span className={value ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
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
    description: 'Please describe the details of the work required.',
    order: 1,
    isRepeatable: false,
    fields: [
      { id: 'requirementTitle', label: 'Requirement Title', type: 'text', required: false, placeholder: 'e.g. Need plumber for bathroom leakage repair' },
      { id: 'requirementDesc', label: 'Description', type: 'textarea', required: false, placeholder: 'Please describe details of the work required...' }
    ]
  },
  {
    id: 'sec_datetime',
    title: 'Date and Time',
    description: 'When do you need this service?',
    order: 2,
    isRepeatable: false,
    fields: [
      { id: 'preferredDate', label: 'Preferred Date', type: 'date', required: false },
      { id: 'preferredTime', label: 'Preferred Time', type: 'time', required: true }
    ]
  },
  {
    id: 'sec_statecity',
    title: 'State & City',
    description: 'Select your state and city.',
    order: 3,
    isRepeatable: false,
    fields: [
      { id: 'state', label: 'State', type: 'dropdown', required: true },
      { id: 'city', label: 'City', type: 'text', required: true, placeholder: 'e.g. Noida' }
    ]
  },
  {
    id: 'sec_address',
    title: 'Address Details',
    description: 'Provide your detailed address.',
    order: 4,
    isRepeatable: false,
    fields: [
      { id: 'houseNo', label: 'House / Flat No.', type: 'text', required: false, placeholder: 'e.g. 104' },
      { id: 'apartment', label: 'Apartment / Society', type: 'text', required: false, placeholder: 'e.g. Maple Heights' },
      { id: 'street', label: 'Street / Road Address', type: 'text', required: true, placeholder: 'e.g. Main Market Road' },
      { id: 'landmark', label: 'Landmark', type: 'text', required: false, placeholder: 'e.g. Near HDFC Bank' },
      { id: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: 'e.g. 201301' }
    ]
  },
  {
    id: 'sec_contact',
    title: 'Contact Details',
    description: 'Masked contact information for matching.',
    order: 5,
    isRepeatable: false,
    fields: [
      { id: 'contactName', label: 'Contact Name', type: 'text', required: true },
      { id: 'contactPhone', label: 'Phone Number', type: 'phone', required: true, placeholder: '10-digit mobile number' },
      { id: 'contactEmail', label: 'Email Address', type: 'email', required: true }
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

// ─── Field Renderer ───────────────────────────────────────────────────────────
const FieldRenderer = ({ field, value, onChange }) => {
  const base = "w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

  switch (field.type) {
    case 'text': case 'email': case 'phone': case 'url':
      return <input type={field.type === 'phone' ? 'tel' : field.type === 'currency' ? 'number' : field.type} className={base} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'textarea':
      return <textarea rows={4} className={`${base} resize-none`} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'number': case 'currency':
      return (
        <div className="relative">
          {field.type === 'currency' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">₹</span>}
          <input type="number" className={`${base} ${field.type === 'currency' ? 'pl-8' : ''}`} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      );

    case 'dropdown':
      return (
        <select className={base} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">— {field.placeholder || 'Select'} —</option>
          {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {(field.options || []).map(o => (
            <label key={o.value} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-violet-400 dark:hover:border-violet-600 transition-colors">
              <input type="radio" name={field.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-violet-600" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{o.label}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox': case 'boolean':
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-800'}`} onClick={() => onChange(!value)}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'left-7' : 'left-1'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value ? 'Yes' : 'No'}</span>
        </label>
      );

    case 'multi_select':
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(field.options || []).map(o => {
            const checked = selected.includes(o.value);
            return (
              <label key={o.value} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${checked ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-violet-300 dark:hover:border-violet-700'}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${checked ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-700'}`}>
                  {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{o.label}</span>
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
      const handleTimeChange = (e) => {
        const val = e.target.value;
        if (preferredDate) {
          const today = new Date();
          const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
          if (preferredDate === todayStr && val) {
            const currentHour = today.getHours();
            const currentMin = today.getMinutes();
            const [h, m] = val.split(':').map(Number);
            if (h < currentHour || (h === currentHour && m < currentMin)) {
              toast({ title: "Invalid Time", description: "Cannot select a past time for today.", variant: "destructive" });
              onChange('');
              return;
            }
          }
        }
        onChange(val);
      };
      return <input type="time" className={base} value={value || ''} onChange={handleTimeChange} />;

    case 'datetime':
      return <input type="datetime-local" className={base} value={value || ''} onChange={e => onChange(e.target.value)} min={new Date().toISOString().slice(0, 16)} />;

    case 'gps':
      return (
        <div className="flex gap-2 items-center">
          <div className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300`}>
            {value ? `${value.lat?.toFixed(5)}, ${value.lng?.toFixed(5)}` : 'No location captured'}
          </div>
          <button type="button" onClick={() => {
            navigator.geolocation?.getCurrentPosition(p => onChange({ lat: p.coords.latitude, lng: p.coords.longitude }));
          }} className="px-4 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-violet-700 transition-colors">
            <MapPin className="h-4 w-4" /> Capture
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
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {field.label}
            {field.required && !['requirementTitle', 'requirementDesc'].includes(field.id) && <span className="text-rose-500">*</span>}
          </label>
          {field.helpText && <p className="text-[10px] text-slate-400 font-medium">{field.helpText}</p>}
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
            <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
              {repeatCount > 1 && <p className="text-[9px] font-black text-slate-400 uppercase">Entry {i + 1}</p>}
              {renderFields(i > 0 ? `repeat_${i}` : '')}
            </div>
          ))}
          <div className="flex gap-2">
            {repeatCount < (section.maxRepeat || 5) && (
              <button type="button" onClick={() => setRepeatCount(c => c + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-100 transition-colors">
                <Plus className="h-3 w-3" /> Add Another
              </button>
            )}
            {repeatCount > 1 && (
              <button type="button" onClick={() => setRepeatCount(c => c - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-colors">
                <Minus className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">{renderFields()}</div>
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

  const isAdmin = user && ['admin', 'superadmin', 'supervisor'].includes(user.role);

  const initialCategoryId = searchParams.get("category") || "";

  // State values
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const draftTimer = useRef(null);

  // Clear service ID when category changes
  useEffect(() => {
    setSelectedServiceId("");
  }, [selectedCategoryId]);

  // Scroll to top on mount or when category/service changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedCategoryId, selectedServiceId]);

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
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const currentTodayStr = `${yyyy}-${mm}-${dd}`;

    if (!preferredDate || preferredDate === currentTodayStr) {
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

  const renderField = (field, suffix = '') => {
    const fieldId = suffix ? `${field.id}__${suffix}` : field.id;

    switch (field.id) {
      case 'requirementTitle':
        return (
          <div className="space-y-1">
            <input
              type="text" required={false} value={requirementTitle} onChange={e => setRequirementTitle(e.target.value)}
              placeholder={field.placeholder || "e.g. Need plumber for bathroom leakage repair"}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
            <p className="text-[9px] text-slate-400 dark:text-slate-500 text-right">{requirementTitle.length} chars (min 10)</p>
          </div>
        );
      case 'requirementDesc':
        return (
          <div className="space-y-1">
            <textarea
              rows={4} required={false} value={requirementDesc} onChange={e => setRequirementDesc(e.target.value)}
              placeholder={field.placeholder || "Please describe details of the work required..."}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none"
            />
            <p className="text-[9px] text-slate-400 dark:text-slate-500 text-right">{requirementDesc.length} chars (min 15)</p>
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
        return (
          <div className="grid grid-cols-2 gap-2">
            <select
              required={field.required}
              value={selectedHour}
              onChange={e => setSelectedHour(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 transition-all"
            >
              <option value="">Hour</option>
              {Array.from({ length: 24 }).map((_, i) => {
                const h = String(i).padStart(2, '0');
                const disabled = (() => {
                  if (!preferredDate || preferredDate === todayStr) {
                    const currentHour = new Date().getHours();
                    const currentMin = new Date().getMinutes();
                    if (i < currentHour) return true;
                    if (i === currentHour && currentMin >= 45) return true;
                  }
                  return false;
                })();
                return <option key={h} value={h} disabled={disabled}>{h}:00 (24h)</option>;
              })}
            </select>
            <select
              required={field.required}
              value={selectedMin}
              onChange={e => setSelectedMin(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 transition-all"
            >
              <option value="">Min</option>
              {['00', '15', '30', '45'].map(m => {
                const disabled = (() => {
                  if ((!preferredDate || preferredDate === todayStr) && selectedHour) {
                    const currentHour = new Date().getHours();
                    const currentMin = new Date().getMinutes();
                    if (Number(selectedHour) === currentHour && Number(m) <= currentMin) {
                      return true;
                    }
                  }
                  return false;
                })();
                return <option key={m} value={m} disabled={disabled}>{m}</option>;
              })}
            </select>
          </div>
        );

      case 'state':
        return (
          <select required={field.required} value={locationDetail.state} onChange={e => setLocationDetail(prev => ({ ...prev, state: e.target.value }))}
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100">
            <option value="">Select State</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all" />

            <div id="city-dropdown" className="hidden absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-40 overflow-y-auto top-full left-0">
              {(STATE_CITIES[locationDetail.state] || [])
                .filter(c => c.toLowerCase().includes((locationDetail.city || '').toLowerCase()))
                .map(city => (
                  <div key={city} onClick={() => setLocationDetail(prev => ({ ...prev, city }))} className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 font-medium text-slate-700 dark:text-slate-300">
                    {city}
                  </div>
                ))}
              {(STATE_CITIES[locationDetail.state] || []).filter(c => c.toLowerCase().includes((locationDetail.city || '').toLowerCase())).length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">No matches found</div>
              )}
            </div>
          </div>
        );

      case 'houseNo':
        return (
          <input type="text" value={locationDetail.houseNo || ''} placeholder={field.placeholder || "e.g. 104"}
            onChange={e => setLocationDetail(prev => ({ ...prev, houseNo: e.target.value.replace(/[^\p{L}\p{N}\s,.-]/gu, '') }))}
            onKeyDown={(e) => {
              if (/[^\p{L}\p{N}\s,.-]/u.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{N}\s,.-]*$"
            title="Special characters are not allowed"
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
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
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
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
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
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
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
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
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
        );

      case 'contactName':
        return (
          <input type="text" required={field.required} value={contactName}
            onChange={e => setContactName(e.target.value.replace(/[^\p{L}\p{M}\s]/gu, ''))}
            onKeyDown={(e) => {
              if (/[^a-zA-Z\s]/.test(e.key) && e.key.length === 1) {
                e.preventDefault();
              }
            }}
            pattern="^[\p{L}\p{M}\s]+$"
            title="Contact name should not accept special characters and numbers"
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
        );
      case 'contactPhone':
        return (
          <input type="tel" required={field.required} value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder={field.placeholder || "10-digit mobile number"}
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
        );
      case 'contactEmail':
        return (
          <input type="email" required={field.required} value={contactEmail}
            onChange={e => setContactEmail(e.target.value.toLowerCase())}
            onKeyDown={(e) => {
              if (/[A-Z]/.test(e.key) && e.key.length === 1) {
                e.preventDefault();
              }
            }}
            pattern="^[^A-Z]*$"
            title="Email address should not contain capital letters"
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none text-slate-900 dark:text-slate-100 transition-all" />
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCoordinates([pos.coords.longitude, pos.coords.latitude]),
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
    });

    return { state, city, pincode, street, area };
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

        const matchedState = STATES.find(s =>
          s.toLowerCase().replace(/[^a-z]/g, '') === parsed.state.toLowerCase().replace(/[^a-z]/g, '')
        ) || '';

        setLocationDetail(prev => ({
          ...prev,
          state: matchedState || prev.state,
          city: parsed.city || prev.city,
          pincode: parsed.pincode || prev.pincode,
          street: parsed.street || prev.street || data.results[0].formatted_address.split(',')[0],
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
        <div className="px-4 py-4 border-b border-white/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center gap-3">
          <h1 className="text-base font-black text-slate-900 dark:text-white">Request Submitted</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-6 animate-in fade-in duration-500">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Submitted Successfully</h2>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-left space-y-2.5 shadow-sm">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Your request has been submitted successfully.</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Nearby verified providers will review your request and contact you directly if interested.</p>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-violet-500" /> No booking has been created</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-violet-500" /> No payment is required</p>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3 pt-4">
            <button onClick={() => navigate('/my-leads')}
              className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-violet-500/20 transition-all active:scale-[0.98]">
              View My Requests
            </button>
            <button onClick={() => navigate('/home')}
              className="w-full py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <Home className="h-4 w-4" /> Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE PAGE FORM
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-28">
      {/* Top Header */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </button>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Lead-Based Request
            </p>
            <h1 className="text-sm font-black text-slate-900 dark:text-white truncate">Create Request</h1>
          </div>
          {savingDraft && (
            <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
              <Loader2 className="h-3 w-3 animate-spin text-violet-500" /> Auto-Saving
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* 1. Category */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 text-left">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Service Category *</label>
          <select
            required
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 transition-all"
          >
            <option value="">— Select a Service Category —</option>
            {categories.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>

          {/* Dynamic sub-services rendering */}
          {(() => {
            const selectedCategory = categories.find(c => c._id === selectedCategoryId);
            if (!selectedCategory?.services?.length) return null;
            return (
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Specific Service *</label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-slate-100 transition-all"
                >
                  <option value="">— Select a Specific Service —</option>
                  {selectedCategory.services.map(srv => (
                    <option key={srv._id} value={srv._id}>{srv.name}</option>
                  ))}
                </select>
              </div>
            );
          })()}
        </div>

        {/* Render sections dynamically (either custom published form schema or the default fallback layout) */}
        {(formSchema?.sections?.length > 0 ? formSchema.sections : getDefaultSections()).map(section => (
          <div key={section.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 text-left animate-in fade-in duration-300">
            <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-3">
              {section.id === 'sec_requirement' ? <FileText className="h-4.5 w-4.5 text-violet-600" /> :
                section.id === 'sec_datetime' ? <Calendar className="h-4.5 w-4.5 text-violet-600" /> :
                  section.id === 'sec_statecity' || section.id === 'sec_address' ? <MapPin className="h-4.5 w-4.5 text-violet-600" /> :
                    section.id === 'sec_contact' ? <User className="h-4.5 w-4.5 text-violet-600" /> :
                      <Sparkles className="h-4.5 w-4.5 text-violet-600" />}
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">{section.title}</h2>
            </div>
            {section.description && (
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium -mt-2 leading-relaxed">{section.description}</p>
            )}

            <SectionRenderer
              section={section}
              formValues={dynamicValues}
              onFieldChange={(fieldId, val) => setDynamicValues(prev => ({ ...prev, [fieldId]: val }))}
              renderField={renderField}
            />

            {/* GPS Map capture specifically embedded inside the Address Details section layout */}
            {section.id === 'sec_address' && (
              <div className="pt-2 border-t border-slate-100/50 dark:border-slate-800/50 space-y-4">
                <button type="button" onClick={captureGPS} disabled={gettingGPS}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 transition-all active:scale-[0.98] disabled:opacity-60">
                  {gettingGPS ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-violet-600" />}
                  {gettingGPS ? 'Capturing GPS Location...' : coordinates ? '✓ GPS Location Captured' : 'Lock GPS Location *'}
                </button>

                {coordinates && (
                  <iframe
                    title="map-frame"
                    className="w-full h-36 rounded-2xl border border-slate-200 dark:border-slate-800"
                    src={`https://maps.google.com/maps?q=${coordinates[1]},${coordinates[0]}&z=15&output=embed`}
                    loading="lazy"
                  />
                )}
              </div>
            )}

            {section.id === 'sec_contact' && (
              <div className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-2xl flex items-start gap-2.5 mt-3">
                <Shield className="h-4.5 w-4.5 text-violet-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-800 dark:text-violet-300 font-medium leading-relaxed">
                  Your contact details and exact address remain completely masked. They are only revealed to verified providers who unlock your request.
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Submit Bar */}
        <div className="pt-2 pb-10">
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-violet-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Submitting Request...</> : <><CheckCircle2 className="h-4.5 w-4.5" /> Submit Request</>}
          </button>
        </div>

      </form>

      {/* Floating Edit Lead Form button for Admins */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            const query = selectedCategoryId
              ? `?category=${selectedCategoryId}${selectedServiceId ? `&service=${selectedServiceId}` : ''}`
              : '';
            navigate(`/admin/lead-forms${query}`);
          }}
          className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-6 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-2xl transition-all active:scale-95 border border-violet-500/30 cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Edit Lead Form
        </button>
      )}
    </div>
  );
};

export default LeadRequirementForm;


