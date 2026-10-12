import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "@/lib/api";
import { mediaUrl } from "@/lib/bannerTracking";
import PromoBannerCarousel from "@/modules/user/components/PromoBannerCarousel";

// A banner whose image fails to load shows nothing rather than a stock ad.
const BLANK = [{ image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }];

/**
 * RozSewa's own (universal) banners for a Sewak. Partners' paid promotional
 * banners are never shown here: those are bought by partners to reach
 * customers in an area, and a Sewak neither buys nor sees them.
 */
const SewakBanners = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    let cancelled = false;
    API.get("/public/banners")
      .then(({ data }) => {
        if (cancelled) return;
        setBanners((Array.isArray(data) ? data : [])
          .filter((b) => b.imageUrl || b.videoUrl)
          .map((b, i) => ({
            id: b._id || i,
            title: b.title || "",
            subtitle: b.description || "",
            // "Book Now" and the like are written for customers.
            ctaText: "",
            link: b.ctaLink || "",
            image: mediaUrl(b.imageUrl),
            video: b.videoUrl ? mediaUrl(b.videoUrl) : null,
          })));
      })
      .catch(() => { if (!cancelled) setBanners([]); });
    return () => { cancelled = true; };
  }, []);

  // Customer pages (/shops, /bazaar …) are not for a Sewak: a tap follows only
  // a link meant for partners or an outside web address.
  const onBannerClick = (banner) => {
    const link = banner.link || "";
    if (/^https?:\/\//i.test(link)) window.open(link, "_blank", "noopener");
    else if (link.startsWith("/provider")) navigate(link);
  };

  if (banners.length === 0) return null;
  return (
    <section data-sewak-banners>
      <PromoBannerCarousel banners={banners} defaultBanners={BLANK} onBannerClick={onBannerClick} />
    </section>
  );
};

export default SewakBanners;
