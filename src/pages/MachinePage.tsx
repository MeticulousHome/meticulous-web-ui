import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import machineBlack from "../assets/machine/machine-black.png";
import machineWhite from "../assets/machine/machine-white.png";
import { useLiveStatus, useMachine } from "../contexts/MachineProvider";
import { useDeviceInfo } from "../hooks/useMachineData";
import type { Machine3DProps } from "../components/machine/Machine3D";
import { StatusTiles } from "../components/machine/StatusTiles";
import { ActionGrid } from "../components/machine/ActionGrid";
import { ShotControls } from "../components/machine/ShotControls";
import { ShotChart } from "../components/machine/ShotChart";
import { ProfileStrip } from "../components/profiles/ProfileStrip";
import { ProfilePicker } from "../components/profiles/ProfilePicker";

// three.js and the model load in their own chunk, after the page. If the
// chunk can't load, the still simply stays.
const Machine3D = lazy<ComponentType<Machine3DProps>>(() =>
  import("../components/machine/Machine3D").catch(() => ({
    default: () => null,
  })),
);

// A still of the 3D machine's front view, swapped for the 3D machine in the
// same frame once it has drawn. Any fade would stack the two where they are
// see-through, and the shadow on the floor would darken while it ran. The
// still keeps the layout and stays if WebGL or the model fails.
const MachineRender = () => {
  const { data: info } = useDeviceInfo();
  const white = info?.color?.toLowerCase() === "white";
  const [model, setModel] = useState<"loading" | "ready" | "failed">("loading");
  return (
    <div className="relative flex items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute bottom-[6%] left-1/2 h-10 w-[70%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-2xl dark:bg-black/60"
      />
      <img
        src={white ? machineWhite : machineBlack}
        alt={`${info?.name ?? "Meticulous"} espresso machine`}
        draggable={false}
        className={`relative max-h-[260px] w-auto object-contain select-none sm:max-h-[360px] lg:max-h-[540px] ${model === "ready" ? "opacity-0" : ""}`}
      />
      {model !== "failed" && (
        <Suspense fallback={null}>
          <Machine3D
            color={white ? "white" : "black"}
            onReady={() => setModel("ready")}
            onError={(error) => {
              console.warn("3D machine unavailable", error);
              setModel("failed");
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

// Refreshes the saved last shot when a shot ends.
const useRefreshLastShotAfterShot = () => {
  const status = useLiveStatus();
  const { machineUrl } = useMachine();
  const queryClient = useQueryClient();
  const wasExtracting = useRef(false);
  const extracting = !!status?.extracting;

  useEffect(() => {
    if (wasExtracting.current && !extracting) {
      // The backend writes the shot file just after the shot ends.
      const timer = setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: [machineUrl, "last-shot"],
          }),
        2000,
      );
      wasExtracting.current = extracting;
      return () => clearTimeout(timer);
    }
    wasExtracting.current = extracting;
  }, [extracting, machineUrl, queryClient]);
};

export const MachinePage = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  useRefreshLastShotAfterShot();

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 pt-6 pb-12 sm:px-8 lg:pt-10">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <MachineRender />
        {/* A fixed width: long profile names truncate instead of widening it. */}
        <div className="flex min-w-0 flex-col gap-6 lg:w-full lg:max-w-[560px] lg:justify-self-end xl:max-w-[600px]">
          <StatusTiles />
          <ActionGrid />
          <div className="h-px bg-line" />
          <ShotControls onPickProfile={() => setPickerOpen(true)} />
          <ShotChart />
        </div>
      </div>
      <ProfileStrip onViewAll={() => setPickerOpen(true)} />
      <ProfilePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
};
