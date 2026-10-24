import type { HttpMethod } from "../../api/endpoints";

const COLORS: Record<HttpMethod, string> = {
  GET: "text-[#1f63b4] bg-[#2a78d6]/12 dark:text-[#7fb2f0]",
  POST: "text-[#0d7a52] bg-[#1baf7a]/14 dark:text-[#5fd3a6]",
  PUT: "text-[#9a6400] bg-[#eda100]/16 dark:text-[#f0c060]",
  PATCH: "text-[#4f3fc0] bg-[#6250d6]/12 dark:text-[#a9a0f0]",
  DELETE: "text-[#b23030] bg-[#e34948]/12 dark:text-[#f08a8a]",
};

export const MethodBadge = ({
  method,
  className = "",
}: {
  method: HttpMethod;
  className?: string;
}) => (
  <span
    className={`inline-flex w-[52px] shrink-0 justify-center rounded-md py-0.5 font-mono text-[10.5px] tracking-wide ${COLORS[method]} ${className}`}
  >
    {method}
  </span>
);
