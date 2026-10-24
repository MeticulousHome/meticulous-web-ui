import { useCallback, useEffect, useRef, useState } from "react";
import { guardedNavigate } from "../lib/navigationGuard";

export type Tab = "machine" | "sensors" | "settings";

const TABS: Tab[] = ["machine", "sensors", "settings"];

// Hash routes: #/machine, #/sensors, #/settings[/section]. Hash routing keeps
// the build servable from any path on the machine's web server.
const parse = (hash = window.location.hash) => {
  const [tab, section] = hash.replace(/^#\/?/, "").split("/");
  return {
    tab: (TABS as string[]).includes(tab) ? (tab as Tab) : "machine",
    section: section || undefined,
  };
};

export const useRoute = () => {
  const [route, setRoute] = useState(() => parse());
  const currentHash = useRef(window.location.hash);

  useEffect(() => {
    // Back/forward (or a typed URL): put the old hash back while a guard
    // decides, then apply the new one if it lets the navigation through.
    const onChange = () => {
      const target = window.location.hash;
      if (target === currentHash.current) return;
      window.history.replaceState(null, "", currentHash.current || "#/");
      guardedNavigate(() => {
        window.history.replaceState(null, "", target);
        currentHash.current = target;
        setRoute(parse(target));
      });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((tab: Tab, section?: string) => {
    const target = section ? `#/${tab}/${section}` : `#/${tab}`;
    guardedNavigate(() => {
      window.history.pushState(null, "", target);
      currentHash.current = target;
      setRoute(parse(target));
    });
  }, []);

  return { ...route, navigate };
};
