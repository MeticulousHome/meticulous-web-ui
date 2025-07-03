import "./switch.css";
import { useState } from "react";

interface SwitchProps {
  isSelected: boolean;
  onValueChange?: (selected: boolean) => void;
}

export const Switch = ({ isSelected = false, onValueChange }: SwitchProps) => {
  const [isActive, setIsActive] = useState<boolean>(isSelected);

  const toggle = () => {
    const newActive = !isActive;
    if (onValueChange) {
      onValueChange(newActive);
    }
    setIsActive(newActive);
  };

  return (
    <div
      className={`switch ${isActive ? "active" : ""} flex items-center cursor-pointer rounded-3xl`}
      onClick={toggle}
    >
      <div className={`slider ${isActive ? "active" : ""} rounded-3xl`} />
    </div>
  );
};
