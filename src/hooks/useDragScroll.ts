import { useEffect, type RefObject } from "react";

// Pixels the pointer must travel before a press becomes a drag, so a plain
// click still reaches the item under it.
const DRAG_THRESHOLD = 5;
// How far the release velocity carries the strip, in ms of travel.
const MOMENTUM_MS = 250;
// Release speed is measured over this last stretch of the drag...
const VELOCITY_WINDOW_MS = 100;
// ...and capped, so a flick glides a few cards, not to the end.
const MAX_VELOCITY = 2.5; // px per ms

// Click-and-drag horizontal scrolling with the mouse (touch keeps the
// browser's own scrolling). On release the strip glides with the drag's
// momentum and settles on the nearest item matching `itemSelector`. The click
// that ends a drag is swallowed so it doesn't select an item.
export const useDragScroll = (
  ref: RefObject<HTMLElement | null>,
  itemSelector: string,
  enabled = true,
) => {
  useEffect(() => {
    const strip = ref.current;
    if (!strip || !enabled) return;

    let startX = 0;
    let startLeft = 0;
    let samples: { x: number; time: number }[] = [];
    let dragging = false;
    let swallowClick = false;

    // px per ms over the last VELOCITY_WINDOW_MS, positive when dragging
    // right; 0 if the pointer rested before release.
    const releaseVelocity = (releasedAt: number) => {
      const recent = samples.filter(
        (sample) => releasedAt - sample.time <= VELOCITY_WINDOW_MS,
      );
      if (recent.length < 2) return 0;
      const first = recent[0];
      const last = recent[recent.length - 1];
      const span = last.time - first.time;
      if (span < 10) return 0;
      const velocity = (last.x - first.x) / span;
      return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
    };

    const restoreSnap = () => {
      strip.style.scrollSnapType = "";
      strip.style.scrollBehavior = "";
    };

    const settle = (releasedAt: number) => {
      const projected =
        strip.scrollLeft - releaseVelocity(releasedAt) * MOMENTUM_MS;
      const styles = getComputedStyle(strip);
      const inset =
        Number.parseFloat(styles.scrollPaddingLeft) ||
        Number.parseFloat(styles.paddingLeft) ||
        0;
      let target = projected;
      let bestDistance = Infinity;
      strip.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => {
        const left = item.offsetLeft - inset;
        const distance = Math.abs(left - projected);
        if (distance < bestDistance) {
          bestDistance = distance;
          target = left;
        }
      });
      const max = strip.scrollWidth - strip.clientWidth;
      strip.scrollTo({
        left: Math.max(0, Math.min(target, max)),
        behavior: "smooth",
      });
      // Put CSS snapping back once the glide ends (scrollend isn't everywhere).
      strip.addEventListener("scrollend", restoreSnap, { once: true });
      setTimeout(restoreSnap, 600);
    };

    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        dragging = true;
        // CSS snapping fights a scroll position set on every move.
        strip.style.scrollSnapType = "none";
        strip.style.scrollBehavior = "auto";
        strip.dataset.dragging = "true";
      }
      strip.scrollLeft = startLeft - dx;
      samples.push({ x: event.clientX, time: event.timeStamp });
      if (samples.length > 20) samples = samples.slice(-20);
    };

    const onPointerUp = (event: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (!dragging) return;
      dragging = false;
      delete strip.dataset.dragging;
      swallowClick = true;
      // The click, if any, fires right after pointerup.
      setTimeout(() => {
        swallowClick = false;
      }, 0);
      settle(event.timeStamp);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      startX = event.clientX;
      startLeft = strip.scrollLeft;
      samples = [{ x: event.clientX, time: event.timeStamp }];
      dragging = false;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClick = false;
    };

    // Images and links would otherwise start a native drag-and-drop.
    const onDragStart = (event: DragEvent) => event.preventDefault();

    strip.addEventListener("pointerdown", onPointerDown);
    strip.addEventListener("click", onClickCapture, true);
    strip.addEventListener("dragstart", onDragStart);
    return () => {
      strip.removeEventListener("pointerdown", onPointerDown);
      strip.removeEventListener("click", onClickCapture, true);
      strip.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      strip.removeEventListener("scrollend", restoreSnap);
    };
  }, [ref, itemSelector, enabled]);
};
