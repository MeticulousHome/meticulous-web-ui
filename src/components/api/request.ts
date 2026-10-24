import type { Endpoint } from "../../api/endpoints";

export interface RequestDraft {
  params: Record<string, string>;
  body: string;
  file: File | null;
}

export interface ApiResult {
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  url: string;
  method: string;
  headers: [string, string][];
  contentType: string;
  size: number;
  blob: Blob;
  // Decoded body for JSON and text responses.
  text?: string;
  json?: unknown;
}

export const initialDraft = (endpoint: Endpoint): RequestDraft => ({
  params: Object.fromEntries(
    (endpoint.params ?? []).map((param) => [
      param.name,
      param.default ??
        (param.required && param.options?.length ? param.options[0] : ""),
    ]),
  ),
  body:
    endpoint.body?.kind === "json"
      ? JSON.stringify(endpoint.body.example, null, 2)
      : endpoint.body?.kind === "text"
        ? endpoint.body.example
        : "",
  file: null,
});

// Validates the draft and builds the URL. Returns an error sentence instead
// when something required is missing.
export const buildUrl = (
  machineUrl: string,
  endpoint: Endpoint,
  draft: RequestDraft,
): { url: string } | { error: string } => {
  let path = endpoint.path;
  const query = new URLSearchParams();
  for (const param of endpoint.params ?? []) {
    const value = (draft.params[param.name] ?? "").trim();
    if (param.in === "path") {
      if (!value && param.required)
        return { error: `Fill in “${param.name}”.` };
      path = path.replace(
        `{${param.name}}`,
        value.split("/").map(encodeURIComponent).join("/"),
      );
    } else if (value) {
      query.set(param.name, value);
    } else if (param.required) {
      return { error: `Fill in “${param.name}”.` };
    }
  }
  const search = query.toString();
  return { url: `${machineUrl}${path}${search ? `?${search}` : ""}` };
};

export const buildBody = (
  endpoint: Endpoint,
  draft: RequestDraft,
): { body?: BodyInit; contentType?: string } | { error: string } => {
  const spec = endpoint.body;
  if (!spec) return {};
  if (spec.kind === "json") {
    if (!draft.body.trim()) return {};
    try {
      JSON.parse(draft.body);
    } catch (error) {
      return {
        error: `The body isn't valid JSON: ${(error as Error).message}`,
      };
    }
    return { body: draft.body, contentType: "application/json" };
  }
  if (spec.kind === "text")
    return { body: draft.body, contentType: "text/plain" };
  if (!draft.file) return { error: "Choose a file to upload." };
  const form = new FormData();
  form.append(spec.field, draft.file);
  return { body: form };
};

export const sendRequest = async (
  method: string,
  url: string,
  body?: BodyInit,
  contentType?: string,
): Promise<ApiResult> => {
  const started = performance.now();
  const response = await fetch(url, {
    method,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  const blob = await response.blob();
  const durationMs = performance.now() - started;
  const responseType = response.headers.get("content-type") ?? "";
  const result: ApiResult = {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    durationMs,
    url,
    method,
    headers: [...response.headers.entries()],
    contentType: responseType,
    size: blob.size,
    blob,
  };
  const textual =
    /json|text|xml|javascript|html/.test(responseType) ||
    (!responseType && blob.size < 1_000_000);
  if (textual && blob.size < 5_000_000) {
    result.text = await blob.text();
    if (/json/.test(responseType) || /^\s*[[{]/.test(result.text)) {
      try {
        result.json = JSON.parse(result.text);
      } catch {
        // Not JSON after all; shown as text.
      }
    }
  }
  return result;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const curlCommand = (
  method: string,
  url: string,
  endpoint: Endpoint,
  draft: RequestDraft,
) => {
  const parts = ["curl", "-X", method, shellQuote(url)];
  const spec = endpoint.body;
  if (spec?.kind === "json" && draft.body.trim()) {
    let compact = draft.body;
    try {
      compact = JSON.stringify(JSON.parse(draft.body));
    } catch {
      // Send as typed.
    }
    parts.push(
      "-H",
      shellQuote("Content-Type: application/json"),
      "-d",
      shellQuote(compact),
    );
  } else if (spec?.kind === "text") {
    parts.push(
      "-H",
      shellQuote("Content-Type: text/plain"),
      "--data-binary",
      shellQuote(draft.body),
    );
  } else if (spec?.kind === "file") {
    parts.push(
      "-F",
      shellQuote(`${spec.field}=@${draft.file?.name ?? "file"}`),
    );
  }
  return parts.join(" ");
};

export const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
