import "./index.css";
import { useEffect, useRef, useState } from "react";

interface BottomModalProps {
  isOpen: boolean;
  onClose: () => void;
  orientation: "vertical" | "horizontal";
  children: React.ReactNode;
}

export const BottomModal = ({
  isOpen,
  onClose,
  orientation = "vertical",
  children,
}: BottomModalProps) => {
  const container = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [shouldClose, setShouldClose] = useState(false);

  const handleClick = (event: Event) => {
    if (!modalRef.current?.contains(event.target as Node)) {
      setShouldClose(true);
      modalRef.current?.classList.add(
        orientation === "horizontal" ? "close-tablet-modal" : "close-modal",
      );
    }
  };

  useEffect(() => {
    if (container.current) {
      container.current.addEventListener("pointerdown", handleClick);
      container.current.addEventListener("mousedown", handleClick);
    }

    return () => {
      container.current?.removeEventListener("pointerdown", handleClick);
      container.current?.removeEventListener("mousedown", handleClick);
    };
  }, [handleClick, container.current]);

  if (!isOpen) {
    container.current = null;
    modalRef.current = null;
    return null;
  }
  const animationClass =
    orientation === "horizontal"
      ? shouldClose
        ? "close-tablet-modal"
        : "initial-tablet-anim"
      : shouldClose
        ? "close-modal"
        : "initial-anim";

  return (
    <div
      ref={container}
      className={`bottom-modal-container flex items-end ${orientation === "horizontal" ? "justify-end" : ""}`}
    >
      <div
        ref={modalRef}
        onAnimationEnd={() => {
          if (shouldClose) {
            setShouldClose(false);
            onClose();
          }
        }}
        className={`bottom-modal slide overflow-auto 
           ${orientation === "horizontal" ? "right-0 h-full w-3/5 bottom-modal-tablet" : "left-0 right-0 w-full h-2/5 rounded-t-3xl"}
           ${animationClass}`}
      >
        <div
          className={`${orientation === "horizontal" ? "h-full w-full flex flex-col justify-center " : ""}`}
        >
          <div className="p-8">{children}</div>
        </div>
      </div>
    </div>
  );
};
