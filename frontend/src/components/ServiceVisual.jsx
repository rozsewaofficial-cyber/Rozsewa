import { useEffect, useState } from "react";
import {
  AirVent, Ambulance, Bath, Battery, Bike, BrickWall, Bug, Cable, Camera, Car, Cctv,
  ChefHat, Cylinder, Drill, Droplet, Droplets, Fan, Flame, GraduationCap, Hammer, Hand,
  HardHat, Hotel, House, KeyRound, Laptop, Leaf, Lightbulb, Microwave, Package, PaintRoller,
  PartyPopper, PlugZap, Refrigerator, Router, Scissors, ShowerHead, Smartphone, Sofa,
  Sparkle, Sparkles, Stethoscope, Thermometer, Toilet, Truck, Tv, WashingMachine, Waves,
  Wrench,
} from "lucide-react";

// A service with no photo of its own used to borrow one shared picture (the
// category's photo, or a stock spa photo), so every card on a page looked
// the same. Without a photo, each service now gets an icon for what it is,
// on a colour of its own.
//
// First match wins, so the more specific words come first.
const ICONS = [
  [/toilet|commode|flush|western seat/, Toilet],
  [/shower|valve/, ShowerHead],
  [/geyser|water heater|heater/, Thermometer],
  [/bath ?tub|bathroom/, Bath],
  [/wash ?basin|sink/, Droplets],
  [/tap|mixer|faucet/, Droplet],
  [/drain|block|clog|sewer|chamber/, Waves],
  [/tank/, Cylinder],
  [/\bac\b|air ?condition|split|cassette/, AirVent],
  [/fridge|refrigerator|deep freezer/, Refrigerator],
  [/washing machine/, WashingMachine],
  [/microwave|oven/, Microwave],
  [/\btv\b|television|led tv/, Tv],
  [/\bfan\b|fans|exhaust/, Fan],
  [/light|bulb|tube ?light|lamp|chandelier/, Lightbulb],
  [/switch|socket|plug|board|doorbell|mcb|fuse/, PlugZap],
  [/wiring|wire|cable/, Cable],
  [/inverter|battery|stabili[sz]er|ups\b/, Battery],
  [/cctv|security camera/, Cctv],
  [/wifi|wi-fi|router|internet/, Router],
  [/pest|termite|cockroach|mosquito|bed ?bug/, Bug],
  [/sofa|carpet|upholster|mattress|curtain/, Sofa],
  [/kitchen|chimney|cook|chef|tiffin/, ChefHat],
  [/maid|housekeep|baby ?sit|caretaker|helper/, House],
  [/bike|scooter|two.?wheeler/, Bike],
  [/car\b|cars|vehicle|denting/, Car],
  [/clean|sanitiz|dust|mop|wash/, Sparkles],
  [/hair|cut|beard|shav|trim|groom/, Scissors],
  [/facial|makeup|make-up|bridal|beauty|manicure|pedicure|wax|thread|eyebrow|lash|mehendi|mehndi|nail|balayage|scalp/, Sparkle],
  [/massage|spa\b|physio|therapy/, Hand],
  [/paint|putty|texture|wallpaper/, PaintRoller],
  [/drill|install|mount|fitting|fixing/, Drill],
  [/carpent|furniture|door|wood|wardrobe|cupboard|bed\b|table|chair|window/, Hammer],
  [/tutor|tuition|teach|class|coaching/, GraduationCap],
  [/pandit|puja|pooja|havan|katha|religious|path\b/, Flame],
  [/ambulance/, Ambulance],
  [/doctor|health|check.?up|nurse|medical|clinic/, Stethoscope],
  [/hotel|room|lodge|stay/, Hotel],
  [/event|party|wedding|decor|birthday|tent|catering/, PartyPopper],
  [/photo|video|camera/, Camera],
  [/mistri|mason|labour|labor|construction/, HardHat],
  [/cement|brick|sand|tile|marble|material/, BrickWall],
  [/shift|packers|movers|truck|transport|tempo/, Truck],
  [/garden|plant|lawn|tree/, Leaf],
  [/lock|key/, KeyRound],
  [/laptop|computer|desktop|printer/, Laptop],
  [/mobile|phone|smartphone/, Smartphone],
  [/plumb|pipe|leak|motor|pump/, Wrench],
];

// Full class names, so Tailwind keeps them.
const TONES = [
  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
];

const hash = (text) => {
  let h = 0;
  for (const ch of String(text || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

const serviceIconFor = (name, hint = "", fallback = Wrench) => {
  const named = String(name || "").toLowerCase();
  const hinted = `${named} ${String(hint || "").toLowerCase()}`;
  // The name decides first; the description only breaks a tie.
  const match = ICONS.find(([rx]) => rx.test(named)) || ICONS.find(([rx]) => rx.test(hinted));
  return match ? match[1] : fallback;
};

/**
 * The picture for a service or combo card: its own photo, or an icon tile
 * when it has none (or the photo link is broken).
 */
const ServiceVisual = ({ src, name, hint, combo = false, className = "", iconClassName = "h-7 w-7" }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || ""}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const Icon = combo ? Package : serviceIconFor(name, hint);
  const tone = TONES[hash(name) % TONES.length];
  return (
    <div className={`flex h-full w-full items-center justify-center ${tone} ${className}`} aria-hidden="true">
      <Icon className={iconClassName} strokeWidth={1.75} />
    </div>
  );
};

export default ServiceVisual;
