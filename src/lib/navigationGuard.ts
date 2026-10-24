// Lets a screen with unsaved changes hold navigation (tabs, settings
// sections, back/forward) until the user decides. The guard gets the
// navigation as `proceed` and returns true to hold it; it then calls
// `proceed` itself once the user has saved or discarded.
type Guard = (proceed: () => void) => boolean;

let guard: Guard | null = null;

export const setNavigationGuard = (next: Guard | null) => {
  guard = next;
};

export const guardedNavigate = (proceed: () => void) => {
  if (guard?.(proceed)) return;
  proceed();
};
