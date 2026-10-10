import { useEffect, useRef } from "react";

// Same-origin tab-to-tab link between the Queue page and the /scan camera tab.
//   camera -> queue: { type: "scan", text }
//   queue -> camera: { type: "pending", plate } | { type: "result", ... }
// Returns post(message); onMessage receives the other tab's messages.
export function useScanChannel(onMessage) {
  const channelRef = useRef(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    const channel = new BroadcastChannel("iturno-scan");
    channel.onmessage = (e) => handlerRef.current(e.data);
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return (message) => channelRef.current?.postMessage(message);
}
