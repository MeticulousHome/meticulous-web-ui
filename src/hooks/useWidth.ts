"use client";

import { useEffect, useState } from "react";

export const useWidth = () => {
  const [width, setWidth] = useState(767);
  const handleResize = () => setWidth(window.innerWidth);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
};
