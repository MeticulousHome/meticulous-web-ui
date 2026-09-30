import { useCallback, useEffect, useRef, useState } from "react";
import { useDevice } from "../../hooks/useDevice";
import { BottomModal } from "./BottomModal";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { useProfiles } from "../../hooks/useProfiles";
import {
  BooleanField,
  DragDropList,
  NumberField,
  ReadOnlyField,
  StringField,
} from "./SettingFields";
import { verifiedMachineFetch } from "../../api/api";
import type { Settings } from "@meticulous-home/espresso-api";
import type { Profile } from "@meticulous-home/espresso-profile";
interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsType extends Settings {
  profile_order: string[];
}

export const MachineSettings = ({ isOpen, onClose }: SettingsProps) => {
  const { device } = useDevice();

  const { data: settings, isLoading, error } = useSettings();
  const { data: profiles } = useProfiles();
  const mutation = useUpdateSettings();

  const modifiedSettings = useRef<Partial<Settings>>({});
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleDownloadArchive = async () => {
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const response = await verifiedMachineFetch("/health/archive");
      if (!response.ok) {
        throw new Error(`Archive request failed: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch?.[1] ?? "meticulous_archive.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setArchiveError(
        e instanceof Error ? e.message : "Failed to download archive",
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  const getProfileName = useCallback(
    (profileId: string) => {
      if (!profiles) return profileId;
      const profile = profiles.find((p: Profile) => p.id === profileId);
      return profile ? profile.name : profileId;
    },
    [profiles],
  );

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  const handleChange = (
    key: keyof Settings | "profile_order",
    value: boolean | number | string | object,
  ) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    modifiedSettings.current = {
      ...modifiedSettings.current,
      [key]: value,
    } as Settings;
  };

  const handleSubmit = () => {
    if (!localSettings) return;
    if (mutation.isPending) return;
    mutation.mutate(modifiedSettings.current, {
      onSuccess: () => {
        modifiedSettings.current = {};
      },
    });
  };

  if (isLoading)
    return <div className="text-center text-gray-500">Loading...</div>;

  if (error)
    return (
      <div className="text-center text-red-500">Error loading settings</div>
    );

  return (
    <BottomModal
      orientation={device === "MOBILE" ? "vertical" : "horizontal"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <h1 className="mb-4 text-3xl">Settings</h1>
      {!localSettings ? (
        <div className="text-center text-gray-500">Loading settings...</div>
      ) : (
        <>
          <h2 className="mb-4 text-2xl">Brew Config</h2>
          <BooleanField
            label={"Enable Sounds"}
            value={localSettings.enable_sounds}
            onChange={(v) => handleChange("enable_sounds", v)}
          />
          <BooleanField
            label={"Auto Start Shot"}
            value={localSettings.auto_start_shot}
            onChange={(v) => handleChange("auto_start_shot", v)}
          />
          <BooleanField
            label={"Auto Purge After Shot"}
            value={localSettings.auto_start_shot}
            onChange={(v) => handleChange("auto_purge_after_shot", v)}
          />
          <NumberField
            label={"Preheat Timeout (minutes)"}
            value={localSettings.heating_timeout}
            onChange={(v) => handleChange("heating_timeout", v)}
          />
          <h2 className="mb-4 text-2xl">Reverse Scrolling</h2>
          <BooleanField
            label={"Home Screen"}
            value={localSettings.reverse_scrolling.home}
            onChange={(v) =>
              handleChange("reverse_scrolling", {
                ...localSettings.reverse_scrolling,
                home: v,
              })
            }
          />
          <BooleanField
            label={"Circular Keyboard"}
            value={localSettings.reverse_scrolling.keyboard}
            onChange={(v) =>
              handleChange("reverse_scrolling", {
                ...localSettings.reverse_scrolling,
                keyboard: v,
              })
            }
          />
          <BooleanField
            label={"Context Menus"}
            value={localSettings.reverse_scrolling.menus}
            onChange={(v) =>
              handleChange("reverse_scrolling", {
                ...localSettings.reverse_scrolling,
                menus: v,
              })
            }
          />
          <h2 className="mb-4 text-2xl">System Config</h2>

          <NumberField
            label={"Debug Data Retention Threshold (days)"}
            value={localSettings.debug_shot_data_retention_days}
            onChange={(v) => handleChange("debug_shot_data_retention_days", v)}
          />
          <StringField
            label={"Idle Screen"}
            value={localSettings.idle_screen}
            onChange={(v) => handleChange("idle_screen", v)}
          />
          <StringField
            label={"Update Channel"}
            value={localSettings.update_channel}
            onChange={(v) => handleChange("update_channel", v)}
          />
          <ReadOnlyField
            label="Timezone detection"
            value={localSettings.timezone_sync}
          />
          <ReadOnlyField label="Timezone" value={localSettings.time_zone} />
          <BooleanField
            label={"SSH Enabled"}
            value={localSettings.ssh_enabled}
            onChange={(v) => handleChange("ssh_enabled", v)}
          />
          <BooleanField
            label={"Telemetry Service"}
            value={localSettings.telemetry_service_enabled}
            onChange={(v) => handleChange("telemetry_service_enabled", v)}
          />
          <div className="flex items-center mb-3 pl-2">
            <button
              onClick={handleDownloadArchive}
              disabled={archiveLoading}
              className="p-2 border-2 border-gray-300 rounded-md shadow-sm bg-gray-800 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {archiveLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Preparing Archive...
                </span>
              ) : (
                "Download System Archive"
              )}
            </button>
            {archiveError && (
              <span className="ml-2 text-sm text-red-400">{archiveError}</span>
            )}
          </div>

          <h2 className="mb-4 text-2xl">Profile Ordering</h2>

          <DragDropList
            value={(localSettings as SettingsType).profile_order?.map(
              (profileId: string) => ({
                key: profileId,
                value: getProfileName(profileId),
              }),
            )}
            onChange={(v) =>
              handleChange(
                "profile_order",
                v.map((item: { key: string }) => item.key),
              )
            }
          />
          <button
            disabled={Object.keys(modifiedSettings.current).length === 0}
            onClick={handleSubmit}
            className="p-2 border-2 border-gray-300 rounded-md shadow-sm bg-green-950 mt-2 text-white text-2xl"
          >
            {Object.keys(modifiedSettings.current).length > 0
              ? "Save Settings"
              : mutation.isError
                ? `Failed to save: ${mutation.error}`
                : mutation.isPending
                  ? "Saving..."
                  : mutation.isSuccess
                    ? "Saved"
                    : "Nothing to save"}
          </button>
        </>
      )}
    </BottomModal>
  );
};
