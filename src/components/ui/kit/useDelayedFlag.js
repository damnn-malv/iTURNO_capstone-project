import { useEffect, useState } from "react";

/**
 * True only after `on` has stayed true for `delay` ms. Use it to show a spinner
 * so that instant actions never flash one. Disable the control right away
 * (using `on` itself) and use this only for the visual.
 */
export default function useDelayedFlag(on, delay = 150) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!on) return undefined;
    const t = setTimeout(() => setShown(true), delay);
    return () => {
      clearTimeout(t);
      setShown(false);
    };
  }, [on, delay]);

  return on && shown;
}
