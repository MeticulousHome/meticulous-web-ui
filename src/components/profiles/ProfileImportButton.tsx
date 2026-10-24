import { useRef } from "react";
import { useProfileActions } from "./useProfileActions";

// A hidden file input behind any trigger element.
export const ProfileImportButton = ({
  children,
  className,
  label = "Import a profile from a JSON file",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFile, importing } = useProfileActions();
  return (
    <>
      <button
        type="button"
        title={label}
        disabled={importing}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
};
