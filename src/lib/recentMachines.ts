// Machines this browser connected to, newest first, for the connection dialog.
const STORAGE_KEY = "meticulous:recent-machines";
const LIMIT = 6;

export interface RecentMachine {
  url: string;
  name?: string;
}

export const readRecentMachines = (): RecentMachine[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item?.url === "string")
      : [];
  } catch {
    return [];
  }
};

export const rememberMachine = (machine: RecentMachine) => {
  const others = readRecentMachines().filter(
    (item) => item.url !== machine.url,
  );
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([machine, ...others].slice(0, LIMIT)),
    );
  } catch {
    // Not remembered; nothing else depends on it.
  }
};

export const forgetMachine = (url: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(readRecentMachines().filter((item) => item.url !== url)),
    );
  } catch {
    // Ignore; the list is a convenience.
  }
};
