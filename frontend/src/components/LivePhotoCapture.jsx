import { useEffect, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import useSelfieCamera from "@/hooks/useSelfieCamera";
import { useToast } from "@/components/ui/use-toast";

/**
 * A photo taken right now, with the camera: there is deliberately no way to
 * pick one from the gallery. On a phone where the page cannot open the camera
 * itself (some WebViews), the system camera is opened instead, never the
 * photo library.
 */
const isTouchDevice = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

const LivePhotoCapture = ({ open, onClose, onCapture, title = "Take a live photo" }) => {
  const { toast } = useToast();
  const fallbackRef = useRef(null);

  const { videoRef, cameraReady, startCamera, stopCamera, takePhoto } = useSelfieCamera({
    onUnavailable: (reason) => {
      if (isTouchDevice() && fallbackRef.current) {
        // The camera only: `capture` makes the phone open it, not the gallery.
        onClose?.();
        fallbackRef.current.click();
        return;
      }
      toast({ title: "Camera not available", description: `${reason} A live photo needs the camera.`, variant: "destructive" });
      onClose?.();
    },
  });

  // Open the camera when the window opens; close it when it shuts.
  useEffect(() => {
    if (open) startCamera();
    else stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shoot = async () => {
    const file = await takePhoto();
    if (!file) {
      toast({ title: "Photo not captured", description: "Wait until your face shows on screen, then tap again.", variant: "destructive" });
      return;
    }
    onClose?.();
    onCapture?.(file);
  };

  return (
    <>
      <input
        ref={fallbackRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        data-live-fallback
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onCapture?.(f);
        }}
      />
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title} data-live-photo>
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-base font-extrabold text-foreground">{title}</h3>
              <button type="button" onClick={onClose} aria-label="Close camera" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mx-5 aspect-square overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              )}
            </div>
            <p className="px-5 pt-3 text-center text-xs font-medium text-muted-foreground">Look at the camera. Photos from the gallery are not accepted.</p>
            <div className="p-5">
              <button
                type="button"
                onClick={shoot}
                disabled={!cameraReady}
                data-live-shutter
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
              >
                <Camera className="h-5 w-5" /> Take photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LivePhotoCapture;
