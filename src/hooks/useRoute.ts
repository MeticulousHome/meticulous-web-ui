import { useCallback, useEffect, useState } from "react";

export type Tab = "machine" | "sensors" | "settings";

const TABS: Tab[] = ["machine", "sensors", "settings"];

// Hash routes: #/machine, #/sensors, #/settings[/section]. Hash routing keeps
// the build servable from any path on the machine's web server.
const parse = () => {
  const [tab, section] = window.location.hash.replace(/^#\/?/, "").split("/");
  return {
    tab: (TABS as string[]).includes(tab) ? (tab as Tab) : "machine",
    section: section || undefined,
  };
};

export const useRoute = () => {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((tab: Tab, section?: string) => {
    window.location.hash = section ? `/${tab}/${section}` : `/${tab}`;
  }, []);

  return { ...route, navigate };
};
