import { motion } from "framer-motion";
import { Tag, Clock, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * The RozSewa Offer card from the spec:
 *
 *   🎁 BATHROOM CLEANING
 *   ₹109   ₹269   🏷️ 59% OFF
 *   Offer Valid Till: 31 Aug          [Book Now]
 *
 * Every figure comes from the server — the percentage is computed there from
 * ((MRP - offer) / MRP), and the MRP itself is a read-only mirror of the
 * catalog price. The card never derives a price of its own, so what is
 * advertised here is what `createBooking` independently recomputes and charges.
 */
const OfferCard = ({ offer, compact = false }) => {
  const navigate = useNavigate();

  const handleBookNow = () => {
    // Hand the checkout the catalog id; the server re-resolves the offer price
    // from that id, so nothing price-related is trusted from this payload.
    localStorage.setItem(
      "rozsewa_checkout_data",
      JSON.stringify({
        shopName: offer.categoryName || "RozSewa",
        category: offer.categoryName || "",
        items: [
          {
            id: offer.target.itemId,
            name: offer.serviceName,
            price: offer.offerPrice,
            qty: 1,
          },
        ],
        total: offer.offerPrice,
        providerId: null,
        requiredProviderCategory:
          offer.target.targetType === "category_service" ? "sewak" : "partner",
        serviceId: offer.target.itemId,
        fromOffer: offer._id,
      }),
    );
    navigate("/checkout");
  };

  const validTill = new Date(offer.validTill).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm ${
        compact ? "w-[260px]" : "w-full"
      }`}
    >
      {offer.image && (
        <div className="relative h-32 w-full overflow-hidden bg-muted">
          <img
            src={offer.image}
            alt={offer.serviceName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-md">
            <Tag className="h-3 w-3" />
            {offer.discountPercent}% OFF
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          🎁 {offer.categoryName || "Offer"}
        </p>
        <h3 className="mt-1 text-sm font-black uppercase leading-tight tracking-tight text-foreground">
          {offer.serviceName}
        </h3>

        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums text-foreground">
            ₹{offer.offerPrice.toLocaleString("en-IN")}
          </span>
          <span className="text-sm font-bold text-muted-foreground line-through">
            ₹{offer.originalPrice.toLocaleString("en-IN")}
          </span>
          {!offer.image && (
            <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              <Tag className="h-3 w-3" />
              {offer.discountPercent}% OFF
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Offer valid till: {validTill}
        </div>

        {/* Whether coins stack on this offer is an admin decision per offer —
            surfaced here so the customer isn't surprised at checkout. */}
        {offer.allowCoins ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Coins className="h-3.5 w-3.5" />
            RozSewa Coins can be used on this offer
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
            <Coins className="h-3.5 w-3.5" />
            Coins not applicable on this offer
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleBookNow}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Book Now
        </motion.button>
      </div>
    </motion.div>
  );
};

export default OfferCard;
