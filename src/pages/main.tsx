import { RealtimeChart } from "../components/RealtimeChart";
import { StatusLine } from "../components/StatusLine";
import { useDevice } from "../hooks/useDevice";
import {
  flowChart,
  pressureChart,
  gravFlowChart,
  weightChart,
  pressureFlowCharts,
  gravFlowWeightCharts,
} from "../util/charts";
import { SettingsIcon } from "../components/Icons/SettingsIcon";
import { useLastShot } from "../hooks/useHistory";
import { useState } from "react";
import { MachineSettings } from "../components/Settings/Settings";
import { DebugData } from "../components/DebugData";
import { LogDownload } from "../components/LogDownload";

export function RealTimePage() {
  const { device } = useDevice();
  const lastShot = useLastShot();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogDownloadOpen, setIsLogDownloadOpen] = useState(false);

  const lastProfile = lastShot.isLoading
    ? "Loading..."
    : lastShot.data?.profile.name || "No profile";

  return (
    <>
      <div className="pb-11">
        <div className="flex justify-between px-1 text-sm mb-4 md:mt-8 w-full">
          <div className="text-gray-secondary md:text-lg">
            Profile: <span className="text-white">{lastProfile}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLogDownloadOpen(true)}
              className="rounded-md border border-gray-500 px-3 py-2 text-white"
            >
              Download logs
            </button>
            <button
              onClick={() => {
                setIsSettingsOpen(true);
              }}
              className="p-2"
              aria-label="Open settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>

        {device === "MOBILE" ? (
          <>
            <div className="md:hidden lg:hidden">
              <RealtimeChart config={pressureFlowCharts} name="pressure-flow" />
              <RealtimeChart
                config={gravFlowWeightCharts}
                name="gravFlow-weight"
              />
            </div>
          </>
        ) : (
          <>
            <div className="hidden md:block md:py-6 md:mt-2">
              <div className=" flex gap-2 ">
                <RealtimeChart
                  config={pressureChart}
                  name="pressure"
                  className="w-1/2"
                  height="300px"
                />
                <RealtimeChart
                  config={flowChart}
                  name="flow"
                  className="w-1/2"
                  height="300px"
                />
              </div>
              <div className="flex gap-2">
                <RealtimeChart
                  config={weightChart}
                  name="weight"
                  className="w-1/2"
                  height="300px"
                />
                <RealtimeChart
                  config={gravFlowChart}
                  name="gravFlow"
                  className="w-1/2"
                  height="300px"
                />
              </div>
            </div>
          </>
        )}

        <StatusLine />
        <DebugData />
      </div>
      <MachineSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <LogDownload
        isOpen={isLogDownloadOpen}
        onClose={() => setIsLogDownloadOpen(false)}
      />
    </>
  );
}

export default RealTimePage;
