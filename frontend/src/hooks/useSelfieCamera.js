import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Front camera for the identity photo at registration.
 *
 * What went wrong before: the stream was handed to the <video> from a 100 ms
 * timer (racing the render), the shutter read the picture before the camera
 * had produced a frame — a 0×0 canvas, which then threw and showed nothing at
 * all — and a refused camera left the partner with no way to add a photo.
 *
 * Here the stream is attached the moment the <video> exists, the shutter
 * refuses until a real frame is there, the picture is scaled down before it is
 * uploaded, and an unavailable camera is reported so the page can fall back to
 * choosing a photo.
 */
const MAX_SIDE = 1024;

export default function useSelfieCamera({ onUnavailable } = {}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const streamRef = useRef(null);
  const nodeRef = useRef(null);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const attach = useCallback((node) => {
    nodeRef.current = node;
    if (!node) return;
    node.muted = true; // required for autoplay on phones
    node.setAttribute("playsinline", "true");
    const stream = streamRef.current;
    if (stream && node.srcObject !== stream) {
      node.srcObject = stream;
      const ready = () => setCameraReady(node.videoWidth > 0);
      node.onloadedmetadata = ready;
      node.onplaying = ready;
      node.play?.().catch(() => {});
    }
  }, []);

  const release = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (nodeRef.current) nodeRef.current.srcObject = null;
    setCameraReady(false);
    setIsCameraOpen(false);
  }, []);

  // A navigation away must not leave the camera light on.
  useEffect(() => release, [release]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailableRef.current?.("This device or browser cannot open the camera.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(false);
      setIsCameraOpen(true);
      // If the <video> is already mounted (a retake), attach right away.
      if (nodeRef.current) attach(nodeRef.current);
      return true;
    } catch (err) {
      const reason =
        err?.name === "NotAllowedError" || err?.name === "SecurityError"
          ? "Camera permission is off."
          : err?.name === "NotFoundError"
            ? "No camera was found."
            : "The camera could not be opened.";
      onUnavailableRef.current?.(reason);
      return false;
    }
  }, [attach]);

  /** Takes the picture and closes the camera. Resolves to a File, or null if no frame was ready. */
  const takePhoto = useCallback(async () => {
    const video = nodeRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size < 1000) return null; // an all-black or empty frame
    release();
    return new File([blob], "selfie.jpg", { type: "image/jpeg" });
  }, [release]);

  return { videoRef: attach, isCameraOpen, cameraReady, startCamera, stopCamera: release, takePhoto };
}
