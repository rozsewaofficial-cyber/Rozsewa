import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, Eye, ChevronUp, ChevronDown, Trash2, ToggleLeft,
  ToggleRight, Save, Globe, Archive, Settings, Repeat,
  Monitor, Tablet, Smartphone, CheckCircle2, AlertCircle,
  GripVertical, List, Type, Hash, DollarSign, AlignLeft,
  Calendar, Clock, Paperclip, Image, MapPin, Mail, Phone, Link, Sparkles, User, FileText, Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "@/lib/api";

// ─── Field Type Definitions ───────────────────────────────────────────────────
const FIELD_TYPES = [
  { type: 'text',         label: 'Text Input',       icon: Type },
  { type: 'textarea',     label: 'Long Text',         icon: AlignLeft },
  { type: 'number',       label: 'Number',            icon: Hash },
  { type: 'currency',     label: 'Currency (₹)',      icon: DollarSign },
  { type: 'dropdown',     label: 'Dropdown',          icon: List },
  { type: 'multi_select', label: 'Multi-Select',      icon: CheckCircle2 },
  { type: 'radio',        label: 'Radio Buttons',     icon: CheckCircle2 },
  { type: 'checkbox',     label: 'Checkbox',          icon: CheckCircle2 },
  { type: 'boolean',      label: 'Yes / No Toggle',   icon: ToggleLeft },
  { type: 'date',         label: 'Date Picker',       icon: Calendar },
  { type: 'time',         label: 'Time Picker',       icon: Clock },
  { type: 'datetime',     label: 'Date & Time',       icon: Calendar },
  { type: 'file',         label: 'File Upload',       icon: Paperclip },
  { type: 'image',        label: 'Image Upload',      icon: Image },
  { type: 'gps',          label: 'GPS Location',      icon: MapPin },
  { type: 'email',        label: 'Email',             icon: Mail },
  { type: 'phone',        label: 'Phone',             icon: Phone },
  { type: 'url',          label: 'URL',               icon: Link },
];

const OPERATORS = [
  { value: 'equals',       label: 'equals' },
  { value: 'not_equals',   label: 'does not equal' },
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'gt',           label: 'is greater than' },
  { value: 'lt',           label: 'is less than' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const newField = () => ({
  id: genId(),
  label: '',
  type: 'text',
  placeholder: '',
  helpText: '',
  required: false,
  sortOrder: 0,
  defaultValue: null,
  options: [],
  validation: {},
  visibilityRules: []
});

const newSection = () => ({
  id: genId(),
  title: '',
  description: '',
  order: 0,
  isRepeatable: false,
  maxRepeat: 5,
  fields: [newField()]
});

const createDefaultField = (props) => ({
  placeholder: '',
  helpText: '',
  required: false,
  sortOrder: 0,
  defaultValue: null,
  options: [],
  validation: {},
  visibilityRules: [],
  ...props
});

const getDefaultSections = () => [
  {
    id: 'sec_requirement',
    title: 'Requirement Details',
    description: 'Please describe the details of the work required.',
    order: 1,
    isRepeatable: false,
    fields: [
      createDefaultField({ id: 'requirementTitle', label: 'Requirement Title', type: 'text', required: true, placeholder: 'e.g. Need plumber for bathroom leakage repair' }),
      createDefaultField({ id: 'requirementDesc', label: 'Description', type: 'textarea', required: true, placeholder: 'Please describe details of the work required...' })
    ]
  },
  {
    id: 'sec_datetime',
    title: 'Date and Time',
    description: 'When do you need this service?',
    order: 2,
    isRepeatable: false,
    fields: [
      createDefaultField({ id: 'preferredDate', label: 'Preferred Date', type: 'date', required: false }),
      createDefaultField({ id: 'preferredTime', label: 'Preferred Time', type: 'time', required: true })
    ]
  },
  {
    id: 'sec_statecity',
    title: 'State & City',
    description: 'Select your state and city.',
    order: 3,
    isRepeatable: false,
    fields: [
      createDefaultField({ id: 'state', label: 'State', type: 'dropdown', required: true }),
      createDefaultField({ id: 'city', label: 'City', type: 'text', required: true, placeholder: 'e.g. Noida' })
    ]
  },
  {
    id: 'sec_address',
    title: 'Address Details',
    description: 'Provide your detailed address.',
    order: 4,
    isRepeatable: false,
    fields: [
      createDefaultField({ id: 'houseNo', label: 'House / Flat No.', type: 'text', required: false, placeholder: 'e.g. 104' }),
      createDefaultField({ id: 'apartment', label: 'Apartment / Society', type: 'text', required: false, placeholder: 'e.g. Maple Heights' }),
      createDefaultField({ id: 'street', label: 'Street / Road Address', type: 'text', required: true, placeholder: 'e.g. Main Market Road' }),
      createDefaultField({ id: 'landmark', label: 'Landmark', type: 'text', required: false, placeholder: 'e.g. Near HDFC Bank' }),
      createDefaultField({ id: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: 'e.g. 201301' })
    ]
  },
  {
    id: 'sec_contact',
    title: 'Contact Details',
    description: 'Masked contact information for matching.',
    order: 5,
    isRepeatable: false,
    fields: [
      createDefaultField({ id: 'contactName', label: 'Contact Name', type: 'text', required: true }),
      createDefaultField({ id: 'contactPhone', label: 'Phone Number', type: 'phone', required: true, placeholder: '10-digit mobile number' }),
      createDefaultField({ id: 'contactEmail', label: 'Email Address', type: 'email', required: true })
    ]
  }
];

// Obsolete components removed to clean up and simplify editor layout

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const AdminLeadForms = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetCategoryId = searchParams.get("category");
  const targetServiceId = searchParams.get("service") || null;

  // Listings
  const [forms,       setForms]       = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active form editor state
  const [activeForm,  setActiveForm]  = useState(null); // null = list view
  const [saving,      setSaving]      = useState(false);
  const [publishing,  setPublishing]  = useState(false);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewViewport, setPreviewViewport] = useState('desktop');

  const VIEWPORTS = [
    { id: 'desktop', label: 'Desktop', icon: Monitor },
    { id: 'tablet',  label: 'Tablet',  icon: Tablet },
    { id: 'mobile',  label: 'Mobile',  icon: Smartphone },
  ];

  useEffect(() => {
    const init = async () => {
      setLoadingList(true);
      let cats = [];
      try {
        const { data } = await API.get('/public/categories');
        cats = (data || []).filter(c => c.businessModel === 'lead');
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }

      try {
        const { data } = await API.get('/leads/admin/forms');
        setForms(data);
        
        if (targetCategoryId) {
          const matchedForm = data.find(f => 
            f.categoryId === targetCategoryId && 
            (f.serviceId === targetServiceId || (!f.serviceId && !targetServiceId))
          );
          if (matchedForm) {
            setActiveForm({ ...matchedForm });
          } else {
            setActiveForm({
              _id: null,
              categoryId: targetCategoryId,
              serviceId: targetServiceId,
              title: `New Lead Form`,
              description: '',
              sections: getDefaultSections(),
              isPublished: false,
              version: 1,
            });
          }
        } else if (data.length === 0) {
          setActiveForm({
            _id: null,
            categoryId: cats[0]?._id || '',
            serviceId: null,
            title: 'New Lead Form',
            description: '',
            sections: getDefaultSections(),
            isPublished: false,
            version: 1,
          });
        }
      } catch {
        toast({ title: 'Failed to load forms', variant: 'destructive' });
      } finally {
        setLoadingList(false);
      }
    };

    init();
  }, [targetCategoryId, targetServiceId]);

  const fetchList = async () => {
    try {
      const { data } = await API.get('/leads/admin/forms');
      setForms(data);
    } catch {}
  };

  // ── Collect all fields across all sections (for conditional visibility UI) ──
  const getAllFields = (form) => {
    if (!form?.sections) return [];
    return form.sections.flatMap(s => s.fields);
  };

  // ── Form CRUD ─────────────────────────────────────────────────────────────────
  const openNewForm = () => {
    setActiveForm({
      _id: null,
      categoryId: categories[0]?._id || '',
      serviceId: null,
      title: 'New Lead Form',
      description: '',
      sections: getDefaultSections(),
      isPublished: false,
      version: 1,
    });
  };

  const openEditForm = (form) => setActiveForm({ ...form });

  const handleSave = async () => {
    if (!activeForm.title.trim()) { toast({ title: 'Form title is required.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const body = { title: activeForm.title, description: activeForm.description, categoryId: activeForm.categoryId, serviceId: activeForm.serviceId || null, sections: activeForm.sections };
      let saved;
      if (activeForm._id) {
        const { data } = await API.put(`/leads/admin/forms/${activeForm._id}`, body);
        saved = data.form;
      } else {
        const { data } = await API.post('/leads/admin/forms', body);
        saved = data.form;
      }
      setActiveForm(saved);
      fetchList();
      toast({ title: 'Form saved successfully.' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!activeForm._id) { toast({ title: 'Save the form first before publishing.', variant: 'destructive' }); return; }
    setPublishing(true);
    try {
      const { data } = await API.post(`/leads/admin/forms/${activeForm._id}/publish`);
      setActiveForm(data.form);
      fetchList();
      toast({ title: `Form published (v${data.form.version})!`, description: 'Customers will now see this form for the configured category.' });
    } catch (err) {
      toast({ title: 'Publish failed', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleArchive = async (formId) => {
    if (!window.confirm('Archive this form? It will no longer be visible to customers.')) return;
    try {
      await API.delete(`/leads/admin/forms/${formId}`);
      toast({ title: 'Form archived.' });
      if (activeForm?._id === formId) setActiveForm(null);
      fetchList();
    } catch {
      toast({ title: 'Archive failed', variant: 'destructive' });
    }
  };

  // ── Section operations ──────────────────────────────────────────────────────
  const updateSection = (sIdx, updated) => {
    const sections = [...activeForm.sections];
    sections[sIdx] = updated;
    setActiveForm(f => ({ ...f, sections }));
  };

  const addSection = () => setActiveForm(f => ({ ...f, sections: [...f.sections, newSection()] }));

  const deleteSection = (sIdx) => setActiveForm(f => ({ ...f, sections: f.sections.filter((_, i) => i !== sIdx) }));

  const moveSection = (sIdx, dir) => {
    const sections = [...activeForm.sections];
    const target   = sIdx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[sIdx], sections[target]] = [sections[target], sections[sIdx]];
    setActiveForm(f => ({ ...f, sections }));
  };

  const addCustomField = (sIdx) => {
    const sections = [...activeForm.sections];
    sections[sIdx].fields.push(createDefaultField({
      id: `custom_${Date.now()}`,
      label: 'Custom Field',
      type: 'text',
      required: false,
      placeholder: 'Enter details'
    }));
    setActiveForm(f => ({ ...f, sections }));
  };

  if (loadingList) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-slate-50/50">
        <Loader2 className="h-10 w-10 text-violet-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Configuration...</p>
      </div>
    );
  }

  // ── LIST / PICKER VIEW (when no form is open) ────────────────────────────────
  if (!activeForm) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Lead Form Builder</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a form to edit or create a new one</p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> New Form
          </button>
        </div>

        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-400">No lead forms yet</p>
            <button
              onClick={openNewForm}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Create First Form
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {forms.map(form => {
              const cat = categories.find(c => c._id === form.categoryId);
              return (
                <div
                  key={form._id}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => openEditForm(form)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 group-hover:text-violet-700 transition-colors">{form.title}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {cat?.name || 'Unknown Category'}
                        {form.serviceId && <span className="ml-1">· Service-specific</span>}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black ${form.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {form.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); openEditForm(form); }}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleArchive(form._id); }}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // FORM EDITOR VIEW
  // ───────────────────────────────────────────────────────────────────────────
  const allFields = getAllFields(activeForm);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm px-6 py-3 flex items-center gap-3">
        <button onClick={() => setActiveForm(null)}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-bold text-xs flex items-center gap-1">
          ← All Forms
        </button>
        <button onClick={() => navigate("/admin/leads")}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-bold text-xs flex items-center gap-1">
          ← Back to Leads
        </button>
        <div className="flex-1 min-w-0">
          <input type="text" value={activeForm.title} onChange={e => setActiveForm(f => ({ ...f, title: e.target.value }))}
            className="text-sm font-black text-slate-900 bg-transparent border-none outline-none w-full" />
          <p className="text-[9px] text-slate-400 font-medium">
            {activeForm.isPublished ? `Published v${activeForm.version}` : `Draft v${activeForm.version}`}
            {activeForm.publishedAt && ` · ${new Date(activeForm.publishedAt).toLocaleDateString('en-IN')}`}
          </p>
        </div>

        {/* Viewport toggles */}
        <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-xl">
          {VIEWPORTS.map(v => {
            const Icon = v.icon;
            return (
              <button key={v.id} onClick={() => setPreviewViewport(v.id)}
                className={`p-1.5 rounded-lg transition-colors ${previewViewport === v.id ? 'bg-white shadow text-violet-700' : 'text-slate-400 hover:text-slate-700'}`}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Category selector */}
        <select value={activeForm.categoryId} onChange={e => setActiveForm(f => ({ ...f, categoryId: e.target.value }))}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none">
          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          {categories.length === 0 && <option>No lead categories</option>}
        </select>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button onClick={handlePublish} disabled={publishing || !activeForm._id}
          className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
          <Globe className="h-3.5 w-3.5" /> {publishing ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      {/* WYSIWYG Customizer Card List */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Category *</label>
            <select
              value={activeForm.categoryId || ''}
              onChange={e => setActiveForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 transition-all"
            >
              <option value="">— Select a Service Category —</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>

            {/* Dynamic sub-services rendering for customization targets */}
            {(() => {
              const selectedCategory = categories.find(c => c._id === activeForm.categoryId);
              if (!selectedCategory?.services?.length) return null;
              return (
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Specific Service (Optional) *</label>
                  <select
                    value={activeForm.serviceId || ''}
                    onChange={e => setActiveForm(f => ({ ...f, serviceId: e.target.value || null }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 transition-all"
                  >
                    <option value="">— Entire Category (All Services) —</option>
                    {selectedCategory.services.map(srv => (
                      <option key={srv._id} value={srv._id}>{srv.name}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>

          {activeForm.sections.map((section, sIdx) => (
            <div key={section.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5 text-left animate-in fade-in duration-300">
              {/* Section Header with Editable Title */}
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                {section.id === 'sec_requirement' ? <FileText className="h-4.5 w-4.5 text-violet-600 shrink-0" /> :
                 section.id === 'sec_datetime' ? <Calendar className="h-4.5 w-4.5 text-violet-600 shrink-0" /> :
                 section.id === 'sec_statecity' || section.id === 'sec_address' ? <MapPin className="h-4.5 w-4.5 text-violet-600 shrink-0" /> :
                 section.id === 'sec_contact' ? <User className="h-4.5 w-4.5 text-violet-600 shrink-0" /> :
                 <Sparkles className="h-4.5 w-4.5 text-violet-600 shrink-0" />}
                <div className="flex-1">
                  <input
                    type="text"
                    value={section.title}
                    onChange={e => {
                      const sections = [...activeForm.sections];
                      sections[sIdx] = { ...section, title: e.target.value };
                      setActiveForm(f => ({ ...f, sections }));
                    }}
                    className="text-xs font-black uppercase tracking-widest text-slate-900 bg-transparent hover:bg-slate-50 border-b border-dashed border-slate-200 focus:bg-white focus:border-violet-500 rounded px-1.5 py-1 outline-none w-full max-w-xs transition-all"
                  />
                </div>
              </div>

              {/* Editable Section Description */}
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Section Description / Sub-text</label>
                <input
                  type="text"
                  value={section.description || ''}
                  onChange={e => {
                    const sections = [...activeForm.sections];
                    sections[sIdx] = { ...section, description: e.target.value };
                    setActiveForm(f => ({ ...f, sections }));
                  }}
                  placeholder="Optional description shown to customers"
                  className="w-full text-xs text-slate-500 bg-transparent hover:bg-slate-50 border-b border-dashed border-slate-200 focus:bg-white focus:border-violet-500 rounded px-1.5 py-1 outline-none transition-all"
                />
              </div>

              {/* Field customization inputs */}
              <div className="space-y-4 pt-2">
                {section.fields.map((field, fIdx) => {
                  const isStandard = ['requirementTitle', 'requirementDesc', 'preferredDate', 'preferredTime', 'state', 'city', 'houseNo', 'apartment', 'street', 'landmark', 'pincode', 'contactName', 'contactPhone', 'contactEmail'].includes(field.id);
                  return (
                    <div key={field.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80 space-y-3">
                      {/* Configuration header with Delete button for custom fields */}
                      <div className="flex items-center justify-between border-b border-slate-100/50 pb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {isStandard ? 'Standard Field Configuration' : 'Custom Field Configuration'}
                        </span>
                        {!isStandard && (
                          <button
                            type="button"
                            onClick={() => {
                              const fields = section.fields.filter((_, idx) => idx !== fIdx);
                              const sections = [...activeForm.sections];
                              sections[sIdx] = { ...section, fields };
                              setActiveForm(f => ({ ...f, sections }));
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Field Label {field.required && <span className="text-rose-500">*</span>}</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={e => {
                              const fields = [...section.fields];
                              fields[fIdx] = { ...field, label: e.target.value };
                              const sections = [...activeForm.sections];
                              sections[sIdx] = { ...section, fields };
                              setActiveForm(f => ({ ...f, sections }));
                            }}
                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none"
                          />
                        </div>

                        {/* Custom fields get type dropdown options */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Field Type</label>
                          {isStandard ? (
                            <div className="text-[10px] text-slate-500 font-bold py-2.5 px-3 bg-white border border-slate-200 rounded-xl capitalize select-none">
                              {field.type}
                            </div>
                          ) : (
                            <select
                              value={field.type}
                              onChange={e => {
                                const fields = [...section.fields];
                                fields[fIdx] = { ...field, type: e.target.value };
                                const sections = [...activeForm.sections];
                                sections[sIdx] = { ...section, fields };
                                setActiveForm(f => ({ ...f, sections }));
                              }}
                              className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none"
                            >
                              <option value="text">Text Input</option>
                              <option value="textarea">Long Text</option>
                              <option value="number">Number</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="date">Date Picker</option>
                              <option value="time">Time Picker</option>
                              <option value="phone">Phone</option>
                              <option value="email">Email</option>
                            </select>
                          )}
                        </div>

                        {/* Placeholder input (only show for text/textarea/phone/email/pincode fields) */}
                        {['text', 'textarea', 'phone', 'email'].includes(field.type) || field.id === 'pincode' ? (
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Placeholder Hint</label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={e => {
                                const fields = [...section.fields];
                                fields[fIdx] = { ...field, placeholder: e.target.value };
                                const sections = [...activeForm.sections];
                                sections[sIdx] = { ...section, fields };
                                setActiveForm(f => ({ ...f, sections }));
                              }}
                              className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-violet-500 outline-none"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1 opacity-50">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Placeholder</label>
                            <div className="text-[10px] text-slate-400 font-medium py-2 px-3 bg-slate-100 rounded-xl">Fixed input template</div>
                          </div>
                        )}
                      </div>

                      {/* Mock visual element */}
                      <div className="pt-1 opacity-70 pointer-events-none">
                        {field.type === 'textarea' ? (
                          <textarea rows={2} placeholder={field.placeholder || "..."} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none resize-none" readOnly />
                        ) : field.type === 'dropdown' ? (
                          <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"><option>{field.placeholder || 'Select...'}</option></select>
                        ) : field.type === 'date' ? (
                          <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none" readOnly />
                        ) : field.type === 'time' ? (
                          <div className="flex gap-2"><select className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"><option>Hour</option></select><select className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"><option>Min</option></select></div>
                        ) : (
                          <input type="text" placeholder={field.placeholder || "..."} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none" readOnly />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Custom Field Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => addCustomField(sIdx)}
                    className="w-full py-3 border border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/20 rounded-2xl text-[10px] font-black text-slate-500 hover:text-violet-600 uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Custom Field
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminLeadForms;
