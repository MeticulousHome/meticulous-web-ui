import { useEffect, useState } from "react";

export const useDevice = () => {
  const [device, setDevice] = useState<"MOBILE" | "TABLET">();

  useEffect(() => {
    const portrait = window.matchMedia("(max-width: 767px)");

    if (portrait.matches) {
      setDevice("MOBILE");
    } else {
      setDevice("TABLET");
    }

    const getDevice = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setDevice("MOBILE");
      } else {
        setDevice("TABLET");
      }
    };

    portrait.addEventListener("change", getDevice);

    return () => {
      portrait.removeEventListener("change", getDevice);
    };
  }, []);

  return {
    device,
  };
};
