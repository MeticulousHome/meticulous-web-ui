import { useEffect, useId, useRef, useState } from "react";
import { useSettings, useUpdateSettings } from "../../hooks/useMachineData";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { SettingRow } from "./fields";

const PRESETS = ["stable", "beta"];
// The backend puts a machine on this channel in limited access
// (limited_access.py): most features stay locked until it's unlocked.
const LIMITED_ACCESS_CHANNEL = "factory";

const fieldClass =
  "h-9 w-44 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-3 focus:border-ink-2 focus:outline-none disabled:opacity-50";

// Stable, Beta, or Custom with a free-text channel name. A custom name saves
// on blur or Enter.
export const UpdateChannelSetting = () => {
  const { data } = useSettings();
  const mutation = useUpdateSettings();
  const notify = useToast();
  const selectId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const current =
    typeof data?.update_channel === "string" ? data.update_channel : "";
  const isPreset = PRESETS.includes(current);
  // Custom picked in the list but no channel saved yet.
  const [customPicked, setCustomPicked] = useState(false);
  const custom = customPicked || (!!current && !isPreset);
  const [draft, setDraft] = useState(isPreset ? "" : current);
  const [editing, setEditing] = useState(false);
  const [pendingFactory, setPendingFactory] = useState(false);

  // Follow the machine's value unless the field is being edited.
  useEffect(() => {
    if (!editing && !isPreset) setDraft(current);
  }, [current, isPreset, editing]);

  const save = (channel: string) =>
    mutation.mutate(
      { update_channel: channel },
      {
        onSuccess: () => {
          setCustomPicked(false);
          notify(`Update channel set to ${channel}`, "success");
        },
        onError: (error) =>
          notify(`Couldn't change the channel: ${error.message}`, "error"),
      },
    );

  const commitDraft = () => {
    const channel = draft.trim();
    if (!channel || channel === current) return;
    if (channel === LIMITED_ACCESS_CHANNEL) {
      setPendingFactory(true);
      return;
    }
    save(channel);
  };

  return (
    <>
      <SettingRow
        label="Update channel"
        htmlFor={selectId}
        description={
          custom
            ? "Any channel name. After an OS update the machine switches to the channel of the image it installed."
            : "Which software releases the machine installs."
        }
      >
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <select
            id={selectId}
            value={custom ? "custom" : current}
            disabled={data === undefined || mutation.isPending}
            onChange={(event) => {
              const choice = event.target.value;
              if (choice === "custom") {
                setCustomPicked(true);
                setDraft(isPreset ? "" : current);
                // Focus once the field has rendered.
                setTimeout(() => inputRef.current?.focus(), 0);
                return;
              }
              setCustomPicked(false);
              if (choice !== current) save(choice);
            }}
            className={`${fieldClass} pr-8`}
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="custom">Custom…</option>
          </select>
          {custom && (
            <input
              ref={inputRef}
              aria-label="Custom update channel"
              value={draft}
              placeholder="channel name"
              spellCheck={false}
              autoComplete="off"
              disabled={mutation.isPending}
              onFocus={() => setEditing(true)}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                setEditing(false);
                commitDraft();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setDraft(isPreset ? "" : current);
                  if (isPreset) setCustomPicked(false);
                  event.currentTarget.blur();
                }
              }}
              className={`${fieldClass} font-mono`}
            />
          )}
        </div>
      </SettingRow>

      <Dialog
        open={pendingFactory}
        onClose={() => setPendingFactory(false)}
        size="sm"
        title="Switch to the factory channel?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingFactory(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-autofocus
              onClick={() => {
                setPendingFactory(false);
                save(LIMITED_ACCESS_CHANNEL);
              }}
            >
              Switch anyway
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          The factory channel puts the machine in limited access: most features
          stay locked until it’s unlocked with a code.
        </p>
      </Dialog>
    </>
  );
};
