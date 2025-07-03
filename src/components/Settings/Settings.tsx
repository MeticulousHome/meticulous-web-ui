import { useCallback, useEffect, useState } from "react";
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

  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

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
    key: string,
    value: boolean | number | string | object,
  ) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = () => {
    if (!localSettings) return;
    if (mutation.isPending) return;
    mutation.mutate(localSettings);
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
            onClick={handleSubmit}
            className="p-2 border-2 border-gray-300 rounded-md shadow-sm bg-green-950 mt-2 text-white text-2xl"
          >
            {mutation.isError
              ? `Failed to save: ${mutation.error}`
              : mutation.isPending
                ? "Saving..."
                : mutation.isSuccess
                  ? "Saved"
                  : "Save Settings"}
          </button>
        </>
      )}
    </BottomModal>
  );
};
