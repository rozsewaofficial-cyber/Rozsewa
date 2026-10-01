import * as LucideIcons from "lucide-react";

// Admin-entered "icon" values are free text: a Lucide name ("Car"), a
// near-miss ("CAR", "car"), an image URL, or something unrelated ("Package").
// Resolve it to something that always draws.
const KEYWORD_ICONS = [
  [/car|auto|vehicle/i, "Car"],
  [/bike|scooter|motor/i, "Bike"],
  [/propert|house|flat|real ?estate/i, "Building2"],
  [/mobile|phone/i, "Smartphone"],
  [/job|work|career/i, "Briefcase"],
  [/electro|appliance|tv|laptop|computer/i, "Tv"],
  [/furnit|sofa|chair/i, "Armchair"],
  [/pet|dog|cat|animal/i, "PawPrint"],
  [/book|sport|hobb|music/i, "BookOpen"],
  [/clean|bath|wash/i, "Sparkles"],
  [/repair|fix|plumb|tool/i, "Wrench"],
  [/paint/i, "Paintbrush"],
  [/cook|chef|kitchen|food/i, "ChefHat"],
  [/drive|taxi|cab/i, "Car"],
  [/garden|plant|flower/i, "Flower2"],
];

const isImageSrc = (v) => /^(https?:)?\/\//i.test(v) || v.startsWith("data:") || v.startsWith("/");

const lookup = (name) => {
  if (!name) return null;
  if (LucideIcons[name]) return LucideIcons[name];
  const wanted = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const key = Object.keys(LucideIcons).find((k) => k.toLowerCase() === wanted);
  return key ? LucideIcons[key] : null;
};

const resolve = (icon, label) => {
  const direct = icon && icon !== "Package" && icon !== "Zap" ? lookup(icon) : null;
  if (direct) return direct;
  const text = `${label || ""} ${icon || ""}`;
  const hit = KEYWORD_ICONS.find(([re]) => re.test(text));
  if (hit) return lookup(hit[1]);
  return lookup(icon) || LucideIcons.Layers;
};

const CategoryIcon = ({ icon, label, className = "h-6 w-6", imgClassName = "h-full w-full object-contain" }) => {
  if (typeof icon === "string" && isImageSrc(icon.trim())) {
    return <img src={icon.trim()} alt={label || ""} className={imgClassName} loading="lazy" />;
  }
  const Icon = resolve(icon, label);
  return <Icon className={className} />;
};

export default CategoryIcon;
