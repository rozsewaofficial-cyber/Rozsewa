// The "how do you work" cards on partner registration (step 2), per account
// type. Individual and Business used to see the same nine cards with the same
// wording; each card now exists only for the account types it makes sense
// for, worded for that type. The ids are what Provider.businessType stores and
// what admin tags a category with (Category.partnerModels), so the two types
// share an id where they share a line of work.
//
// Keep the ids in step with backend/config/partnerModels.js.

export const ACCOUNT_TYPES = [
  {
    id: "individual",
    label: "Individual",
    description: "You do the work yourself",
    icon: "User",
  },
  {
    id: "business",
    label: "Business",
    description: "A shop, firm or team with a business name",
    icon: "Building2",
  },
];

const MODELS = [
  {
    id: "shop",
    icon: "Store",
    business: { label: "Retail & Shops", description: "Shops and showrooms" },
  },
  {
    id: "hotel",
    icon: "Building",
    business: { label: "Hospitality", description: "Hotels, PG and lodges" },
  },
  {
    id: "service_provider",
    icon: "Sparkles",
    individual: { label: "Service Expert", description: "Repairs, beauty, cleaning and more" },
    business: { label: "Service Agency", description: "A team of service professionals" },
  },
  {
    id: "taxi",
    icon: "Car",
    individual: { label: "Taxi / Logistics", description: "Drive your own vehicle" },
    business: { label: "Fleet & Logistics", description: "Vehicles and drivers you manage" },
  },
  {
    id: "delivery",
    icon: "Truck",
    individual: { label: "Delivery Partner", description: "Deliver parcels and orders yourself" },
    business: { label: "Courier & Delivery", description: "A delivery company or team" },
  },
  {
    id: "tutor_doc",
    icon: "GraduationCap",
    individual: { label: "Doctor / Tutor", description: "Personal consultations and classes" },
    business: { label: "Clinic / Coaching", description: "Clinics, labs and institutes" },
  },
  {
    id: "labour",
    icon: "HardHat",
    individual: { label: "Skilled Worker", description: "Mistri, painter, labour and more" },
    business: { label: "Contractor Firm", description: "Contractors with a work team" },
  },
  {
    id: "food",
    icon: "Utensils",
    individual: { label: "Home Kitchen", description: "Tiffin and home-cooked food" },
    business: { label: "Restaurant / Cafe", description: "Restaurants, cafes and caterers" },
  },
  {
    id: "property_dealer",
    icon: "Home",
    individual: { label: "Property Broker", description: "Independent property agent" },
    business: { label: "Real Estate Agency", description: "Real estate firms and dealers" },
  },
];

/** The cards an account type sees, worded for that type. */
export const partnerModelsFor = (accountType) =>
  MODELS.filter((m) => m[accountType]).map((m) => ({ id: m.id, icon: m.icon, ...m[accountType] }));

/** Whether a card is offered to an account type. */
export const isModelFor = (modelId, accountType) =>
  !!MODELS.find((m) => m.id === modelId)?.[accountType];

/** Every card, for the admin category editor (labelled with both wordings). */
export const ALL_PARTNER_MODELS = MODELS.map((m) => ({
  id: m.id,
  label: [m.individual?.label, m.business?.label].filter(Boolean).join(" / "),
}));

/**
 * Whether a category belongs under a card. A category admin hasn't tagged yet
 * shows under every card, so nothing disappears before it is tagged.
 */
export const categoryFitsModel = (category, modelId) =>
  !Array.isArray(category?.partnerModels) ||
  category.partnerModels.length === 0 ||
  category.partnerModels.includes(modelId);
