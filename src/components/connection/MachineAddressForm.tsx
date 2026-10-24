import { useEffect, useState } from "react";
import { Check, Server, X } from "lucide-react";
import { useMachine } from "../../contexts/MachineProvider";
import { defaultMachineUrl, normalizeMachineUrl } from "../../api/api";
import {
  forgetMachine,
  readRecentMachines,
  rememberMachine,
  type RecentMachine,
} from "../../lib/recentMachines";
import { useDeviceInfo } from "../../hooks/useMachineData";
import { Button } from "../ui/Button";

// Asks the machine for its name, to confirm the address before switching.
const probe = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${url}/api/v1/machine`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = (await response.json()) as { name?: string };
    return info.name ?? url;
  } finally {
    clearTimeout(timer);
  }
};

const host = (url: string) => url.replace(/^https?:\/\//, "");

export const MachineAddressForm = ({ onDone }: { onDone?: () => void }) => {
  const { machineUrl, setMachineUrl, connection } = useMachine();
  const { data: info } = useDeviceInfo();
  const [address, setAddress] = useState(host(machineUrl));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentMachine[]>(readRecentMachines);
  const fallback = defaultMachineUrl();

  // Keep the list labelled with the names machines report.
  useEffect(() => {
    if (connection === "connected" && info?.name) {
      rememberMachine({ url: machineUrl, name: info.name });
      setRecent(readRecentMachines());
    }
  }, [connection, info?.name, machineUrl]);

  const connectTo = (url: string, name?: string) => {
    rememberMachine({ url, name });
    setRecent(readRecentMachines());
    setMachineUrl(url);
    setAddress(host(url));
    setError(null);
    setUnreachable(null);
    onDone?.();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = normalizeMachineUrl(address);
    if (!url) {
      setError("Type an IP address or a URL, for example 10.10.0.42.");
      return;
    }
    setChecking(true);
    setError(null);
    setUnreachable(null);
    try {
      connectTo(url, await probe(url));
    } catch {
      setUnreachable(url);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="machine-address" className="text-sm text-ink-2">
          Machine address
        </label>
        <div className="flex gap-2">
          <input
            id="machine-address"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setError(null);
              setUnreachable(null);
            }}
            placeholder="10.10.0.42"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-canvas px-3 font-mono text-sm text-ink placeholder:text-ink-3 focus:border-ink-2 focus:outline-none"
          />
          <Button type="submit" variant="primary" loading={checking}>
            Connect
          </Button>
        </div>
        <p className="text-xs text-ink-3">
          IP or URL. A bare IP uses port 80, like the machine’s own web page.
        </p>
        {error && <p className="text-sm text-bad">{error}</p>}
        {unreachable && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas p-3 text-sm">
            <span className="text-ink-2">
              No answer from{" "}
              <span className="font-mono">{host(unreachable)}</span>.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => connectTo(unreachable)}
            >
              Use it anyway
            </Button>
          </div>
        )}
      </form>

      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm text-ink-2">Recent machines</h3>
          <ul className="flex flex-col gap-1">
            {recent.map((machine) => {
              const current = machine.url === machineUrl;
              return (
                <li key={machine.url} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => connectTo(machine.url, machine.name)}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised ${current ? "bg-raised" : ""}`}
                  >
                    <Server size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {machine.name ?? host(machine.url)}
                      </span>
                      <span className="block truncate font-mono text-xs text-ink-3">
                        {host(machine.url)}
                      </span>
                    </span>
                    {current && (
                      <Check size={16} className="shrink-0 text-good" />
                    )}
                  </button>
                  {!current && (
                    <button
                      type="button"
                      aria-label={`Forget ${machine.name ?? host(machine.url)}`}
                      title="Forget"
                      onClick={() => {
                        forgetMachine(machine.url);
                        setRecent(readRecentMachines());
                      }}
                      className="rounded-md p-1.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-raised hover:text-ink focus:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {machineUrl !== fallback && (
        <button
          type="button"
          onClick={() => {
            setMachineUrl(null);
            setAddress(host(fallback));
            onDone?.();
          }}
          className="self-start text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Go back to{" "}
          {fallback === window.location.origin
            ? "this page's machine"
            : host(fallback)}
        </button>
      )}
    </div>
  );
};
