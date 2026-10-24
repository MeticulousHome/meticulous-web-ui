import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Lock,
  RotateCcw,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";
import { ENDPOINTS, type Endpoint } from "../../api/endpoints";
import { useMachine } from "../../contexts/MachineProvider";
import { saveBlob } from "../../lib/download";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { JsonView } from "./JsonView";
import { MethodBadge } from "./MethodBadge";
import {
  buildBody,
  buildUrl,
  curlCommand,
  formatBytes,
  initialDraft,
  sendRequest,
  type ApiResult,
  type RequestDraft,
} from "./request";

const SELECTED_KEY = "meticulous:api-endpoint";

const isLocalOnly = (endpoint: Endpoint) =>
  endpoint.notes?.startsWith("Local only") ?? false;

const readSelected = () => {
  try {
    const id = localStorage.getItem(SELECTED_KEY);
    return ENDPOINTS.find((endpoint) => endpoint.id === id) ?? null;
  } catch {
    return null;
  }
};

const EndpointList = ({
  selected,
  onSelect,
}: {
  selected: Endpoint | null;
  onSelect: (endpoint: Endpoint) => void;
}) => {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = ENDPOINTS.filter(
      (endpoint) =>
        !needle ||
        endpoint.path.toLowerCase().includes(needle) ||
        endpoint.summary.toLowerCase().includes(needle) ||
        endpoint.method.toLowerCase() === needle ||
        endpoint.group.toLowerCase().includes(needle),
    );
    const byGroup = new Map<string, Endpoint[]>();
    matches.forEach((endpoint) => {
      byGroup.set(endpoint.group, [
        ...(byGroup.get(endpoint.group) ?? []),
        endpoint,
      ]);
    });
    return [...byGroup.entries()];
  }, [query]);

  return (
    <div className="flex min-h-0 flex-col">
      <label className="mb-3 flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-canvas px-3 focus-within:border-ink-2">
        <Search size={16} className="text-ink-3" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${ENDPOINTS.length} endpoints`}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </label>
      <nav
        aria-label="Endpoints"
        className="flex flex-col gap-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-260px)]"
      >
        {groups.length === 0 && (
          <p className="px-2 text-sm text-ink-3">Nothing matches.</p>
        )}
        {groups.map(([group, endpoints]) => (
          <div key={group}>
            <h4 className="mb-1 px-2 text-xs tracking-wide text-ink-3 uppercase">
              {group}
            </h4>
            <ul>
              {endpoints.map((endpoint) => {
                const active = endpoint.id === selected?.id;
                return (
                  <li key={endpoint.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(endpoint)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        active ? "bg-raised" : "hover:bg-raised/60"
                      }`}
                    >
                      <MethodBadge
                        method={endpoint.method}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[12.5px] text-ink">
                          {endpoint.path.replace("/api/v1", "")}
                        </span>
                        <span className="block truncate text-xs text-ink-2">
                          {endpoint.summary}
                        </span>
                      </span>
                      {isLocalOnly(endpoint) ? (
                        <Lock
                          size={13}
                          className="mt-1 shrink-0 text-ink-3"
                          aria-label="Local only"
                        />
                      ) : (
                        endpoint.danger === "destructive" && (
                          <TriangleAlert
                            size={14}
                            className="mt-1 shrink-0 text-bad"
                            aria-label="Destructive"
                          />
                        )
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
};

const fieldClass =
  "h-9 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-3 focus:border-ink-2 focus:outline-none";

const statusTone = (status: number) =>
  status >= 500
    ? "text-bad"
    : status >= 400
      ? "text-warn"
      : status >= 200 && status < 300
        ? "text-good"
        : "text-ink-2";

const ResponseView = ({ result }: { result: ApiResult }) => {
  const [showHeaders, setShowHeaders] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isImage = result.contentType.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(result.blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result, isImage]);

  const download = () =>
    saveBlob(
      result.blob,
      result.url.split("/").pop()?.split("?")[0] || "response",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={`${statusTone(result.status)}`}>
          {result.status} {result.statusText}
        </span>
        <span className="text-ink-3">{result.durationMs.toFixed(0)} ms</span>
        <span className="text-ink-3">{formatBytes(result.size)}</span>
        {result.contentType && (
          <span className="font-mono text-xs text-ink-3">
            {result.contentType}
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHeaders((value) => !value)}
          >
            {showHeaders ? "Hide headers" : "Headers"}
          </Button>
          <Button size="sm" variant="ghost" onClick={download}>
            <Download size={14} />
            Save
          </Button>
        </span>
      </div>
      {showHeaders && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-canvas p-3 font-mono text-xs">
          {result.headers.map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-ink-3">{name}</dt>
              <dd className="break-all text-ink-2">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="max-h-[520px] overflow-auto rounded-xl border border-line bg-canvas p-4">
        {imageUrl ? (
          <img src={imageUrl} alt="Response" className="max-h-96 rounded-md" />
        ) : result.json !== undefined ? (
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-2">
            <JsonView value={result.json} />
          </pre>
        ) : result.text !== undefined ? (
          result.text ? (
            <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-2">
              {result.text.length > 200_000
                ? `${result.text.slice(0, 200_000)}\n… (truncated, use Save)`
                : result.text}
            </pre>
          ) : (
            <p className="text-sm text-ink-3">Empty body.</p>
          )
        ) : (
          <p className="text-sm text-ink-2">
            Binary response ({formatBytes(result.size)}). Use Save to download
            it.
          </p>
        )}
      </div>
    </div>
  );
};

const RequestPanel = ({ endpoint }: { endpoint: Endpoint }) => {
  const { machineUrl } = useMachine();
  // nginx forwards the browser's address, so the backend's loopback check
  // refuses these from any browser, including on the machine's own page.
  const localOnly = isLocalOnly(endpoint);
  const [draft, setDraft] = useState<RequestDraft>(() =>
    initialDraft(endpoint),
  );
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const built = buildUrl(machineUrl, endpoint, draft);
  const previewUrl =
    "url" in built ? built.url : `${machineUrl}${endpoint.path}`;

  const setParam = (name: string, value: string) =>
    setDraft((current) => ({
      ...current,
      params: { ...current.params, [name]: value },
    }));

  const send = async () => {
    setConfirming(false);
    setError(null);
    const target = buildUrl(machineUrl, endpoint, draft);
    if ("error" in target) return setError(target.error);
    const body = buildBody(endpoint, draft);
    if ("error" in body) return setError(body.error);
    setSending(true);
    try {
      setResult(
        await sendRequest(
          endpoint.method,
          target.url,
          body.body,
          body.contentType,
        ),
      );
    } catch (requestError) {
      setResult(null);
      setError(
        `The request didn't complete: ${(requestError as Error).message}. The machine may be unreachable or the call blocked by the browser.`,
      );
    } finally {
      setSending(false);
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(
        curlCommand(endpoint.method, previewUrl, endpoint, draft),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("The browser didn't allow copying to the clipboard.");
    }
  };

  const pathParams =
    endpoint.params?.filter((param) => param.in === "path") ?? [];
  const queryParams =
    endpoint.params?.filter((param) => param.in === "query") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm break-all text-ink">
            {endpoint.path}
          </code>
        </div>
        <p className="mt-2 text-[15px] text-ink">{endpoint.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {endpoint.danger === "destructive" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-bad/10 px-2 py-0.5 text-xs text-bad">
              <TriangleAlert size={12} /> Destructive
            </span>
          )}
          {endpoint.danger === "caution" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-warn/12 px-2 py-0.5 text-xs text-warn">
              <TriangleAlert size={12} /> Changes the machine
            </span>
          )}
          {isLocalOnly(endpoint) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2">
              <Lock size={12} /> Local only
            </span>
          )}
        </div>
        {endpoint.notes && (
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            {endpoint.notes}
          </p>
        )}
      </div>

      {(pathParams.length > 0 || queryParams.length > 0) && (
        <div className="flex flex-col gap-3">
          {[
            ["Path parameters", pathParams],
            ["Query parameters", queryParams],
          ].map(([title, params]) =>
            (params as typeof pathParams).length === 0 ? null : (
              <fieldset key={title as string} className="flex flex-col gap-3">
                <legend className="mb-2 text-sm text-ink-2">
                  {title as string}
                </legend>
                {(params as typeof pathParams).map((param) => (
                  <label
                    key={param.name}
                    className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4"
                  >
                    <span className="flex items-baseline gap-1 font-mono text-[13px] text-ink">
                      {param.name}
                      {param.required && <span className="text-bad">*</span>}
                      <span className="text-[11px] text-ink-3">
                        {param.type}
                      </span>
                    </span>
                    <span className="flex flex-col gap-1">
                      {param.options || param.type === "boolean" ? (
                        <select
                          value={draft.params[param.name] ?? ""}
                          onChange={(event) =>
                            setParam(param.name, event.target.value)
                          }
                          className={`${fieldClass} font-mono`}
                        >
                          {!param.required && (
                            <option value="">(not set)</option>
                          )}
                          {(param.options ?? ["true", "false"]).map(
                            (option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <input
                          value={draft.params[param.name] ?? ""}
                          onChange={(event) =>
                            setParam(param.name, event.target.value)
                          }
                          inputMode={
                            param.type === "number" ? "decimal" : undefined
                          }
                          placeholder={
                            param.default ??
                            (param.required ? "required" : "optional")
                          }
                          className={`${fieldClass} font-mono`}
                        />
                      )}
                      {param.description && (
                        <span className="text-xs text-ink-3">
                          {param.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            ),
          )}
        </div>
      )}

      {endpoint.body && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-2">
              Body{" "}
              <span className="font-mono text-xs text-ink-3">
                {endpoint.body.kind === "json"
                  ? "application/json"
                  : endpoint.body.kind === "text"
                    ? "text/plain"
                    : `multipart · ${endpoint.body.field}`}
              </span>
            </span>
            {endpoint.body.kind !== "file" && (
              <span className="flex gap-1">
                {endpoint.body.kind === "json" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      try {
                        setDraft((current) => ({
                          ...current,
                          body: JSON.stringify(
                            JSON.parse(current.body),
                            null,
                            2,
                          ),
                        }));
                      } catch {
                        setError(
                          "The body isn't valid JSON, so it can't be formatted.",
                        );
                      }
                    }}
                  >
                    Format
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      body: initialDraft(endpoint).body,
                    }))
                  }
                >
                  <RotateCcw size={13} />
                  Example
                </Button>
              </span>
            )}
          </div>
          {endpoint.body.kind === "file" ? (
            <input
              type="file"
              accept={endpoint.body.accept}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))
              }
              className="text-sm text-ink-2 file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-raised file:px-4 file:text-sm file:text-ink hover:file:bg-raised-hover"
            />
          ) : (
            <textarea
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              spellCheck={false}
              rows={Math.min(
                18,
                Math.max(4, draft.body.split("\n").length + 1),
              )}
              className="w-full rounded-xl border border-line-strong bg-canvas p-3 font-mono text-[12.5px] leading-relaxed text-ink focus:border-ink-2 focus:outline-none"
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <code
          className="block truncate rounded-lg bg-canvas px-3 py-2 font-mono text-xs text-ink-2"
          title={previewUrl}
        >
          {endpoint.method} {previewUrl}
        </code>
        {localOnly && (
          <p className="flex gap-2 rounded-lg bg-raised px-3 py-2.5 text-sm text-ink-2">
            <Lock size={14} className="mt-0.5 shrink-0 text-ink-3" />
            Only software running on the machine itself can call this endpoint.
            The machine refuses it from a browser (403), also when it serves
            this page, so it can’t be sent from here.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={endpoint.danger === "destructive" ? "danger" : "primary"}
            loading={sending}
            disabled={localOnly}
            onClick={() =>
              endpoint.danger === "destructive" ? setConfirming(true) : send()
            }
          >
            {!sending && <Send size={15} />}
            Send request
          </Button>
          <Button variant="outline" onClick={copyCurl}>
            {copied ? (
              <Check size={15} className="text-good" />
            ) : (
              <Copy size={15} />
            )}
            {copied ? "Copied" : "Copy curl"}
          </Button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </div>

      {result && (
        <div className="border-t border-line pt-5">
          <h4 className="mb-3 text-sm text-ink-2">Response</h4>
          <ResponseView result={result} />
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="Send this request?"
        description={`${endpoint.method} ${endpoint.path}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={send} data-autofocus>
              Send anyway
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          {endpoint.summary}. This can’t be undone from here.
        </p>
      </Dialog>
    </div>
  );
};

const ACKNOWLEDGED_KEY = "meticulous:api-risks-acknowledged";

// Asked once per browser session.
const readAcknowledged = () => {
  try {
    return sessionStorage.getItem(ACKNOWLEDGED_KEY) === "true";
  } catch {
    return false;
  }
};

const RiskGate = ({ onAccept }: { onAccept: () => void }) => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
      <div className="flex gap-3">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <h3 className="text-base text-ink">Use the API with care</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            These endpoints act on the machine directly, with none of the
            safeguards of the Dial or the app. Depending on the endpoint, a
            request can move the piston, turn on the heater, change settings,
            delete profiles or shot history, or install software. Requests run
            as soon as you send them.
          </p>
          <label className="mt-5 flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            I understand the risks of using the machine’s API directly.
          </label>
          <Button
            variant="primary"
            className="mt-5"
            disabled={!checked}
            onClick={onAccept}
          >
            Show the endpoints
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ApiExplorer = () => {
  const [acknowledged, setAcknowledged] = useState(readAcknowledged);
  const [selected, setSelected] = useState<Endpoint | null>(readSelected);

  if (!acknowledged) {
    return (
      <RiskGate
        onAccept={() => {
          setAcknowledged(true);
          try {
            sessionStorage.setItem(ACKNOWLEDGED_KEY, "true");
          } catch {
            // Asked again next time.
          }
        }}
      />
    );
  }

  const select = (endpoint: Endpoint | null) => {
    setSelected(endpoint);
    try {
      if (endpoint) localStorage.setItem(SELECTED_KEY, endpoint.id);
      else localStorage.removeItem(SELECTED_KEY);
    } catch {
      // Not remembered.
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      <div className={selected ? "hidden lg:block" : ""}>
        <EndpointList selected={selected} onSelect={select} />
      </div>
      <div
        className={`min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${selected ? "" : "hidden lg:block"}`}
      >
        {selected ? (
          <>
            <button
              type="button"
              onClick={() => select(null)}
              className="mb-4 flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink lg:hidden"
            >
              <ArrowLeft size={16} />
              All endpoints
            </button>
            {/* Keyed so each endpoint starts from its own example. */}
            <RequestPanel key={selected.id} endpoint={selected} />
          </>
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
            <p className="text-[15px] text-ink">Pick an endpoint</p>
            <p className="max-w-sm text-sm text-ink-2">
              Every HTTP endpoint of the machine’s backend, with its parameters
              and an example body. Requests go straight to the machine this page
              is connected to.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
