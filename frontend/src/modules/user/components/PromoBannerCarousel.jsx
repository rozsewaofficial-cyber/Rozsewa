import { useState, useRef, useEffect } from "react";

// Self-contained so it can be rendered more than once on the same page
// (e.g. once at the top of Home, once above Bazaar Chats) without two
// instances fighting over one scroll ref/currentBanner index.
const PromoBannerCarousel = ({ banners, defaultBanners, onBannerClick }) => {
  const [currentBanner, setCurrentBanner] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => {
        const next = (prev + 1) % banners.length;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            left: next * scrollRef.current.clientWidth,
            behavior: "smooth"
          });
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleScroll = (e) => {
    if (!e.target) return;
    const scrollLeft = e.target.scrollLeft;
    const width = e.target.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      if (index !== currentBanner) {
        setCurrentBanner(index);
      }
    }
  };

  if (banners.length === 0) return null;

  return (
    <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] max-h-[220px] rounded-[4px] overflow-hidden shadow-sm group bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        {banners.map((banner, idx) => (
          <div
            key={`${banner.id}-${idx}`}
            onClick={() => onBannerClick(banner)}
            className="w-full h-full shrink-0 snap-center snap-always relative cursor-pointer"
          >
            {banner.video ? (
              <video
                src={banner.video}
                className="w-full h-full object-cover pointer-events-none"
                autoPlay
                muted
                loop
                playsInline
                poster={banner.image}
              />
            ) : (
              <img
                src={banner.image}
                className="w-full h-full object-cover pointer-events-none"
                alt="Promo Banner"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = defaultBanners[idx % defaultBanners.length].image;
                }}
              />
            )}
            {(banner.title || banner.subtitle) && (
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                {banner.title && (
                  <h2 className="text-white text-base sm:text-xl font-black max-w-[80%] leading-tight drop-shadow-md">
                    {banner.title}
                  </h2>
                )}
                {banner.subtitle && (
                  <p className="text-white/90 text-[10px] sm:text-sm font-semibold mt-0.5 max-w-[80%] leading-snug drop-shadow-md">
                    {banner.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Banner Pagination Dots */}
      <div className="absolute bottom-3 right-4 flex gap-1.5 z-20 bg-black/20 backdrop-blur-md px-2 py-1.5 rounded-full pointer-events-none">
        {banners.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentBanner ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PromoBannerCarousel;
