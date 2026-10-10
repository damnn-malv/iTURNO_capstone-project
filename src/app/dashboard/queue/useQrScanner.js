import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

const REARM_MS = 1500; // QR must leave the frame this long before the same code re-fires

const errorToStatus = (err) => {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-camera";
  return "busy";
};

// Hidden background QR reader: attach videoRef/canvasRef to off-screen elements.
// onResult(text) fires once per QR — again only for a different code, or the
// same code after it has left the frame.
// The camera runs while the component using this hook is mounted — it is only
// used by the /scan tab, so closing that tab turns the camera off.
export function useQrScanner(onResult) {
  const [liveStatus, setStatus] = useState("starting");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let stream = null;
    let raf = null;
    let lastCode = null;
    let lastSeen = 0;

    const scanFrame = () => {
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, {
          inversionAttempts: "dontInvert",
        });
        const now = Date.now();
        if (code?.data) {
          if (code.data !== lastCode || now - lastSeen > REARM_MS) {
            onResultRef.current(code.data);
          }
          lastCode = code.data;
          lastSeen = now;
        }
      }
      raf = requestAnimationFrame(scanFrame);
    };

    const start = async () => {
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("no-camera");
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!devices.some((d) => d.kind === "videoinput")) {
          if (!cancelled) setStatus("no-camera");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setStatus("on");
        raf = requestAnimationFrame(scanFrame);
      } catch (err) {
        if (!cancelled) setStatus(errorToStatus(err));
      }
    };

    start();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, []);

  return { videoRef, canvasRef, status: liveStatus };
}

export const SCANNER_STATUS_LABEL = {
  starting: "Starting camera…",
  on: "Camera on",
  "no-camera": "No camera found",
  blocked: "Camera access blocked",
  busy: "Camera in use by another app",
};
