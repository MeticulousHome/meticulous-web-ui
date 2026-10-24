// Catalog of every HTTP endpoint of meticulous-backend (branch `beta`, commit
// f403168, 2026-10-20), rendered by the API explorer page.
//
// The backend listens on 127.0.0.1:8080 only; LAN clients reach it through the
// machine's nginx on port 80 (and 443 with a self-signed certificate), which
// proxies /api and /socket.io and sets X-Real-IP. Endpoints marked "Local only"
// answer 403 to any request whose X-Real-IP is not a loopback address, so they
// only work from the machine itself (Dial) or through an SSH tunnel.

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface EndpointParam {
  name: string;
  in: "path" | "query";
  required?: boolean;
  type: "string" | "number" | "boolean";
  options?: string[];
  default?: string;
  description?: string;
}

export type EndpointBody =
  | { kind: "json"; example: unknown }
  | { kind: "file"; field: string; accept?: string }
  | { kind: "text"; example: string };

export interface Endpoint {
  id: string; // unique kebab-case slug, e.g. "history-search-post"
  group: string; // e.g. "Actions", "Machine", "Settings", "Profiles", ...
  method: HttpMethod;
  path: string; // full path with {param} placeholders, e.g. "/api/v1/action/{action}"
  summary: string; // one short line, sentence case, what it does
  params?: EndpointParam[];
  body?: EndpointBody;
  response?: "json" | "binary" | "image" | "text";
  danger?: "caution" | "destructive"; // omit for read-only/harmless
  notes?: string; // only when useful: modes it needs, gotchas
}

const LOCAL_ONLY =
  "Local only: answers 403 when called through nginx from another address (any non-loopback X-Real-IP).";

const ACTIONS = [
  "start",
  "stop",
  "tare",
  "preheat",
  "continue",
  "finish",
  "home",
  "purge",
  "scale_master_calibration",
  "reset",
  "abort",
];

const ACTION_NOTES =
  "start brews the loaded profile (sends the last loaded one first if needed). stop and abort end the current profile; abort answers 200 with an empty body. finish ends the user stages of a running shot. purge is refused with 409 while the motor-stress alarm is up. reset restarts the ESP32. scale_master_calibration starts the Acaia load-cell factory calibration. An unknown action answers 400 with the list of allowed actions.";

const USER_SETTING_KEYS = [
  "enable_sounds",
  "disallow_firmware_flashing",
  "disable_ui_features",
  "debug_shot_data_retention_days",
  "auto_start_shot",
  "auto_purge_after_shot",
  "tare_behavior",
  "partial_retraction",
  "heat_on_boot",
  "heating_timeout",
  "update_channel",
  "idle_screen",
  "reverse_scrolling",
  "allow_legacy_json",
  "shot_data_sharing",
  "report_contact_mail",
  "allow_stage_skipping",
  "usb_mode",
  "timezone_sync",
  "time_zone",
  "ssh_enabled",
  "profile_order",
  "hostname_override",
  "clock_format_24_hour",
];

const SOUND_NAMES = [
  "startup",
  "heating_start",
  "heating_end",
  "brewing_start",
  "brewing_end",
  "abort",
  "idle",
  "notification",
];

const EXAMPLE_PROFILE_ID = "8b0d2f3e-5a41-4c6e-9d27-1f3a6b9c0e42";

// Minimal espresso profile (schema of the profile_schema submodule): one
// pressure stage that ends on time or weight.
const EXAMPLE_PROFILE = {
  id: EXAMPLE_PROFILE_ID,
  name: "API explorer test",
  author: "API explorer",
  author_id: "00000000-0000-0000-0000-000000000000",
  previous_authors: [],
  temperature: 90,
  final_weight: 36,
  variables: [],
  display: { accentColor: "#F06018" },
  stages: [
    {
      key: "pressure_1",
      name: "Pressure",
      type: "pressure",
      dynamics: {
        points: [
          [0, 9],
          [30, 9],
        ],
        over: "time",
        interpolation: "linear",
      },
      exit_triggers: [
        { type: "time", value: 30, relative: true, comparison: ">=" },
        { type: "weight", value: 36, relative: false, comparison: ">=" },
      ],
      limits: [{ type: "flow", value: 4 }],
    },
  ],
};

const EXAMPLE_LOCAL_ID = "01929a3e-7b2c-7d4e-8f10-123456789abc";

const PROFILE_ID_PARAM: EndpointParam = {
  name: "id",
  in: "path",
  required: true,
  type: "string",
  description: "Profile UUID (hex digits and dashes)",
};

const REPORT_LOCAL_ID_PARAM: EndpointParam = {
  name: "localID",
  in: "path",
  required: true,
  type: "string",
  description:
    "Report localID, a lowercase UUID from /reports/request or /reports/create",
};

const HISTORY_FILE_PATH_PARAM: EndpointParam = {
  name: "path",
  in: "path",
  type: "string",
  description:
    "Empty for the day folders, a day (2026-10-23) for its files, or a file (2026-10-23/08:15:02.shot.json.zst)",
};

export const ENDPOINTS: Endpoint[] = [
  // Actions
  {
    id: "action-post",
    group: "Actions",
    method: "POST",
    path: "/api/v1/action/{action}",
    summary: "Send an action to the machine",
    params: [
      {
        name: "action",
        in: "path",
        required: true,
        type: "string",
        options: ACTIONS,
      },
    ],
    response: "json",
    danger: "caution",
    notes: ACTION_NOTES,
  },
  {
    id: "action-get",
    group: "Actions",
    method: "GET",
    path: "/api/v1/action/{action}",
    summary: "Send an action to the machine (GET alias)",
    params: [
      {
        name: "action",
        in: "path",
        required: true,
        type: "string",
        options: ACTIONS,
      },
    ],
    response: "json",
    danger: "caution",
    notes: "Same handler and effect as POST. " + ACTION_NOTES,
  },

  // Machine
  {
    id: "machine-info-get",
    group: "Machine",
    method: "GET",
    path: "/api/v1/machine",
    summary: "Get machine info: name, serial, firmware and software versions",
    response: "json",
    notes:
      "Includes repository branches and commits, version history, manufacturing flag and Pour Over support flags.",
  },
  {
    id: "machine-unlock-post",
    group: "Machine",
    method: "POST",
    path: "/api/v1/machine/unlock",
    summary: "Unlock a limited-access machine with an unlock code",
    body: { kind: "json", example: { code: "12345" } },
    response: "json",
    danger: "caution",
    notes:
      "Only changes anything on machines in limited access (update channel 'factory'): a valid code moves the update channel to 'stable'. A wrong code answers 403; more than 10 failures in 60 s lock the endpoint for 30 s (429 with Retry-After).",
  },
  {
    id: "machine-backlight-post",
    group: "Machine",
    method: "POST",
    path: "/api/v1/machine/backlight",
    summary: "Dim the display backlight",
    body: {
      kind: "json",
      example: { brightness: 0.5, interpolation: "curve", animation_time: 1 },
    },
    response: "json",
    danger: "caution",
    notes:
      "brightness is 0 to 1 (clamped); interpolation is 'curve' (default) or 'linear'; animation_time is in seconds. Success answers 200 with an empty body. Does nothing in emulation.",
  },
  {
    id: "machine-time-post",
    group: "Machine",
    method: "POST",
    path: "/api/v1/machine/time",
    summary: "Set the system date and time",
    body: { kind: "json", example: { date: "2026-10-23T18:30:00Z" } },
    response: "json",
    danger: "caution",
    notes:
      "date is an ISO 8601 string; a timezone-aware value is converted to local time.",
  },
  {
    id: "machine-factory-reset-get",
    group: "Machine",
    method: "GET",
    path: "/api/v1/machine/factory_reset",
    summary: "Factory reset: delete all user data and reboot",
    params: [
      {
        name: "confirm",
        in: "query",
        required: true,
        type: "boolean",
        description: "Must be true, otherwise 400",
      },
    ],
    response: "json",
    danger: "destructive",
    notes:
      LOCAL_ONLY +
      " Deletes every non-hidden entry under /meticulous-user (profiles, history, settings) and reboots, so no response arrives on real hardware. Only simulated in emulation.",
  },
  {
    id: "machine-root-password-get",
    group: "Machine",
    method: "GET",
    path: "/api/v1/machine/root-password",
    summary: "Get the machine's root password",
    response: "json",
    notes:
      LOCAL_ONLY +
      " Returns the password in clear text ('root' when none is stored).",
  },

  // Settings
  {
    id: "settings-get",
    group: "Settings",
    method: "GET",
    path: "/api/v1/settings",
    summary: "Get all user settings",
    response: "json",
  },
  {
    id: "settings-get-one",
    group: "Settings",
    method: "GET",
    path: "/api/v1/settings/{setting}",
    summary: "Get one user setting",
    params: [
      {
        name: "setting",
        in: "path",
        required: true,
        type: "string",
        options: USER_SETTING_KEYS,
      },
    ],
    response: "json",
    notes: "Answers {<setting>: value}; 404 for an unknown key.",
  },
  {
    id: "settings-post",
    group: "Settings",
    method: "POST",
    path: "/api/v1/settings",
    summary: "Change one or more user settings",
    body: {
      kind: "json",
      example: { enable_sounds: true, clock_format_24_hour: true },
    },
    response: "json",
    danger: "caution",
    notes:
      "Send only the keys to change; each value must keep the stored type (unknown key or wrong type answers 404, nothing is saved). Answers all settings and emits the socket event 'settings'. Side effects: ssh_enabled starts or stops SSH, update_channel changes the OTA channel, usb_mode switches the USB role, time_zone and timezone_sync change the system time zone, and heating_timeout, auto_purge_after_shot, tare_behavior and partial_retraction are pushed to the ESP32.",
  },
  {
    id: "timezones-get",
    group: "Settings",
    method: "GET",
    path: "/api/v1/timezones/{region}",
    summary: "List time zone countries, or the cities of one country",
    params: [
      {
        name: "region",
        in: "path",
        required: true,
        type: "string",
        options: ["countries", "cities"],
        default: "countries",
      },
      {
        name: "filter",
        in: "query",
        type: "string",
        default: "",
        description:
          "countries: lowercase prefix of the country name. cities: exact country name as returned by countries.",
      },
    ],
    response: "json",
    notes: "An empty region means countries. Errors answer 403.",
  },
  {
    id: "manufacturing-get",
    group: "Settings",
    method: "GET",
    path: "/api/v1/manufacturing",
    summary: "Get the manufacturing settings schema for the Dial",
    response: "json",
    notes:
      "Answers 204 with no body unless the machine is in manufacturing mode.",
  },
  {
    id: "manufacturing-post",
    group: "Settings",
    method: "POST",
    path: "/api/v1/manufacturing",
    summary: "Change manufacturing settings",
    body: { kind: "json", example: { skip_stage: false } },
    response: "json",
    danger: "caution",
    notes:
      "Answers 410 outside manufacturing mode. Keys: enabled, last_boot_mode, skip_stage; each value must keep the stored type.",
  },

  // Profiles
  {
    id: "profile-list-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/list",
    summary: "List saved profiles",
    params: [
      {
        name: "full",
        in: "query",
        type: "boolean",
        default: "false",
        description: "Include each profile's stages",
      },
    ],
    response: "json",
    notes:
      "The Manual mode profile is left out. On a limited-access (factory channel) machine only the built-in simple profile is listed.",
  },
  {
    id: "profile-defaults-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/defaults",
    summary: "List the built-in default profiles",
    response: "json",
    notes: "Answers {default: [...], community: []}.",
  },
  {
    id: "profile-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/get/{id}",
    summary: "Get one profile by id",
    params: [PROFILE_ID_PARAM],
    response: "json",
  },
  {
    id: "profile-save-post",
    group: "Profiles",
    method: "POST",
    path: "/api/v1/profile/save",
    summary: "Create or update a profile",
    body: { kind: "json", example: EXAMPLE_PROFILE },
    response: "json",
    danger: "caution",
    notes:
      "A missing or empty id gets a new UUID. Validated against the profile schema (400 on errors). A body with brew_type 'pour_over' is saved as a Pour Over profile instead (422 invalid, 413 too large, 409 limit reached). Optional header X-Change-Id is echoed in the 'profile' socket event, but it is not in Access-Control-Allow-Headers, so a cross-origin browser cannot send it.",
  },
  {
    id: "profile-from-manual-post",
    group: "Profiles",
    method: "POST",
    path: "/api/v1/profile/from_manual",
    summary: "Save a profile built from a recorded manual-mode brew",
    body: { kind: "json", example: { name: "My manual brew" } },
    response: "json",
    danger: "caution",
    notes:
      "Both fields are optional: name (string) and shot_id (history id or uuid; defaults to the latest manual brew). 404 when no manual brew exists, 409 when the shot has no target samples.",
  },
  {
    id: "profile-load-post",
    group: "Profiles",
    method: "POST",
    path: "/api/v1/profile/load",
    summary:
      "Load a profile from the request body onto the machine without saving it",
    body: { kind: "json", example: EXAMPLE_PROFILE },
    response: "json",
    danger: "caution",
    notes:
      "Answers {name, id}. 409 when the machine is busy, 403 while the motor-stress alarm is up, 400 for schema or variable errors. Does not start the shot.",
  },
  {
    id: "profile-load-id-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/load/{id}",
    summary: "Load a saved profile onto the machine",
    params: [PROFILE_ID_PARAM],
    response: "json",
    danger: "caution",
    notes:
      "Answers {name, id}; 409 when the machine is busy, 404 for an unknown id. Does not start the shot.",
  },
  {
    id: "profile-delete",
    group: "Profiles",
    method: "DELETE",
    path: "/api/v1/profile/delete/{id}",
    summary: "Delete a profile",
    params: [PROFILE_ID_PARAM],
    response: "json",
    danger: "destructive",
    notes:
      "Answers the deleted profile. Optional header X-Change-Id (see profile save).",
  },
  {
    id: "profile-delete-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/delete/{id}",
    summary: "Delete a profile (GET alias)",
    params: [PROFILE_ID_PARAM],
    response: "json",
    danger: "destructive",
    notes: "Same handler as DELETE: a plain GET deletes the profile.",
  },
  {
    id: "profile-changes-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/changes",
    summary: "List recent profile changes (create, update, delete, load)",
    response: "json",
  },
  {
    id: "profile-last-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/last",
    summary: "Get the last loaded profile",
    response: "json",
    notes:
      "Answers {profile, load_time}, or 204 with no body when nothing was loaded yet.",
  },
  {
    id: "profile-selected-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/selected",
    summary: "Get the profile currently highlighted on the Dial",
    response: "json",
    notes: "Answers {id, type, from}, or 204 when nothing is highlighted.",
  },
  {
    id: "profile-legacy-post",
    group: "Profiles",
    method: "POST",
    path: "/api/v1/profile/legacy",
    summary: "Send a legacy firmware JSON profile straight to the machine",
    body: {
      kind: "json",
      example: { id: EXAMPLE_PROFILE_ID, name: "Legacy profile" },
    },
    response: "json",
    danger: "caution",
    notes:
      "Answers 404 with no body unless the setting allow_legacy_json is true. The body is the full legacy (firmware) JSON and must contain name and id; 409 when the machine is busy.",
  },
  {
    id: "profile-images-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/image",
    summary: "List the default profile image file names",
    response: "json",
  },
  {
    id: "profile-image-file-get",
    group: "Profiles",
    method: "GET",
    path: "/api/v1/profile/image/{filename}",
    summary: "Get a profile image",
    params: [
      {
        name: "filename",
        in: "path",
        required: true,
        type: "string",
        description:
          "e.g. 59894b10354b95395b434b49399966f2.png (from a profile's display.image)",
      },
    ],
    response: "image",
    notes:
      "Plain static file handler: sends no CORS headers, so it works in <img> but not in a cross-origin fetch.",
  },

  // History
  {
    id: "history-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history",
    summary: "Search shot history with query parameters",
    params: [
      {
        name: "query",
        in: "query",
        type: "string",
        description: "Matches profile names and stage names",
      },
      {
        name: "ids",
        in: "query",
        type: "string",
        description:
          "History id, history uuid or profile id; repeat the parameter for several",
      },
      {
        name: "start_date",
        in: "query",
        type: "number",
        description: "Epoch seconds",
      },
      {
        name: "end_date",
        in: "query",
        type: "number",
        description: "Epoch seconds",
      },
      {
        name: "order_by",
        in: "query",
        type: "string",
        options: ["date", "profile"],
        description: "Repeatable",
      },
      {
        name: "sort",
        in: "query",
        type: "string",
        options: ["asc", "desc"],
        default: "desc",
      },
      { name: "max_results", in: "query", type: "number", default: "20" },
      {
        name: "dump_data",
        in: "query",
        type: "boolean",
        default: "true",
        description: "Include each shot's sample data",
      },
    ],
    response: "json",
    notes:
      "Answers {history: [...]}. With dump_data=true responses get large quickly.",
  },
  {
    id: "history-search-post",
    group: "History",
    method: "POST",
    path: "/api/v1/history",
    summary: "Search shot history with a JSON query",
    body: {
      kind: "json",
      example: {
        query: "",
        ids: [],
        start_date: null,
        end_date: null,
        order_by: ["date"],
        sort: "desc",
        max_results: 10,
        dump_data: false,
      },
    },
    response: "json",
    notes:
      "All fields are optional (same meaning as the GET parameters). Answers {history: [...]}; 422 with pydantic errors for invalid fields.",
  },
  {
    id: "history-profile-search-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/search",
    summary: "Autocomplete profile names found in history",
    params: [{ name: "query", in: "query", type: "string", default: "" }],
    response: "json",
  },
  {
    id: "history-current-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/current",
    summary: "Get the shot being recorded right now",
    response: "json",
    notes: "null when no shot is running.",
  },
  {
    id: "history-last-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/last",
    summary: "Get the last recorded shot with its data",
    response: "json",
  },
  {
    id: "history-stats-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/stats",
    summary: "Get shot statistics and the machine's lifetime shot count",
    response: "json",
    notes: "mileage comes from the ESP32 and is null until it has reported it.",
  },
  {
    id: "history-upload-index-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/upload-index",
    summary: "List history file names for upload",
    params: [
      {
        name: "max_results",
        in: "query",
        type: "number",
        default: "200",
        description: "1 to 200",
      },
      {
        name: "after",
        in: "query",
        type: "string",
        description: "Only files sorting after this file path",
      },
    ],
    response: "json",
    notes: LOCAL_ONLY,
  },
  {
    id: "history-rating-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/rating/{shotId}",
    summary: "Get a shot's rating",
    params: [
      {
        name: "shotId",
        in: "path",
        required: true,
        type: "string",
        description: "History entry uuid",
      },
    ],
    response: "json",
  },
  {
    id: "history-rating-post",
    group: "History",
    method: "POST",
    path: "/api/v1/history/rating/{shotId}",
    summary: "Rate a shot",
    params: [
      {
        name: "shotId",
        in: "path",
        required: true,
        type: "string",
        description: "History entry uuid",
      },
    ],
    body: { kind: "json", example: { rating: "like" } },
    response: "json",
    danger: "caution",
    notes: "rating is 'like', 'dislike' or null (clears it).",
  },
  {
    id: "history-files-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/files/{path}",
    summary: "Browse shot files, or get one shot file as JSON",
    params: [
      HISTORY_FILE_PATH_PARAM,
      {
        name: "compressed",
        in: "query",
        type: "string",
        description:
          "Any value (e.g. 1), even 'false', downloads a .zst file as is instead of decompressed JSON; leave empty for JSON",
      },
    ],
    response: "json",
    notes:
      "A folder answers [{name, url}] newest first. A file is decompressed and served as JSON (the .zst suffix may be omitted). With compressed, a .zst file downloads as binary.",
  },
  {
    id: "history-files-redirect-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/files",
    summary: "Redirect to the shot file listing",
    response: "json",
    notes:
      "301 to /api/v1/history/files/. The redirect has no CORS headers, so cross-origin fetches fail; call the trailing-slash path instead.",
  },
  {
    id: "history-debug-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/debug/{path}",
    summary: "Browse debug shot files, or get one as JSON",
    params: [
      {
        name: "path",
        in: "path",
        type: "string",
        description:
          "Empty for the day folders, a day (2026-10-23), a file (2026-10-23/08:15:02.shot.json.zst) or a debug zip",
      },
      {
        name: "compressed",
        in: "query",
        type: "string",
        description:
          "Any value (e.g. 1), even 'false', downloads a .zst file as is instead of decompressed JSON; leave empty for JSON",
      },
    ],
    response: "json",
    notes:
      "Debug shots carry every sensor sample. Folders answer [{name, url}]; .zst files are decompressed to JSON (or CSV for .csv.zst); a .zip downloads as binary.",
  },
  {
    id: "history-debug-redirect-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/debug",
    summary: "Redirect to the debug shot file listing",
    response: "json",
    notes:
      "301 to /api/v1/history/debug/. No CORS headers on the redirect; call the trailing-slash path instead.",
  },
  {
    id: "history-debug-zip-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/debug.zip",
    summary: "Zip all debug shots and download the archive",
    response: "binary",
    notes:
      "Builds a new debug-<date>-<time>.zip (can take a while on a full disk), then redirects to it under /api/v1/history/debug/.",
  },
  {
    id: "history-last-debug-file-get",
    group: "History",
    method: "GET",
    path: "/api/v1/history/last-debug-file",
    summary: "Get the most recent debug shot file as JSON",
    response: "json",
    notes:
      "Redirects (302) to the newest .zst under /api/v1/history/debug/; 404 when there is none.",
  },

  // Pour-over
  {
    id: "pour-over-history-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/history/pour-over",
    summary: "List Pour Over brew records",
    params: [
      {
        name: "max_results",
        in: "query",
        type: "number",
        default: "50",
        description: "1 to 200",
      },
      {
        name: "sort",
        in: "query",
        type: "string",
        options: ["asc", "desc"],
        default: "desc",
      },
      {
        name: "after",
        in: "query",
        type: "string",
        description: "Cursor: only records whose file path sorts after this",
      },
      {
        name: "mode",
        in: "query",
        type: "string",
        options: ["free_pour", "profile"],
      },
    ],
    response: "json",
    notes:
      "Answers {history: [...]}, metadata only (the record itself is under /history/pour-over/files/).",
  },
  {
    id: "pour-over-history-post",
    group: "Pour-over",
    method: "POST",
    path: "/api/v1/history/pour-over",
    summary: "Store a Pour Over brew record",
    body: {
      kind: "json",
      example: {
        schemaVersion: 4,
        id: "c3f1a2b4-0d5e-4f6a-8b7c-9d0e1f2a3b4c",
        brewType: "pour_over",
        mode: "free_pour",
        name: "Free pour",
        source: "dial",
        startedAt: "2026-10-23T08:00:00Z",
        completedAt: "2026-10-23T08:03:00Z",
        recipe: {
          profileId: null,
          profileName: "Free pour",
          doseG: 15,
          targetWaterG: 250,
          pourTargets: [],
        },
        measurements: {
          emptyServerG: 300,
          setupG: 0,
          waterPouredG: 250,
          beverageG: 220,
          retainedG: 30,
          durationMs: 180000,
          status: "measured",
        },
        pours: [
          {
            number: 1,
            startTimeMs: 0,
            endTimeMs: 30000,
            startWeightG: 0,
            endWeightG: 250,
            waterG: 250,
            averageFlowGps: 8.3,
            peakFlowGps: 10,
          },
        ],
        samples: [
          { t: 0, w: 0, f: 0, p: 0 },
          { t: 30000, w: 250, f: 0, p: 1 },
        ],
        completion: "brewer_removed",
        sync: { status: "pending", attempts: 0 },
      },
    },
    response: "json",
    danger: "caution",
    notes:
      LOCAL_ONLY +
      " (Only the Dial writes Pour Over history; GET stays open to the LAN.) 201 created, 200 when the identical record exists, 409 for a different record with the same id, 422 invalid, 413 too large.",
  },
  {
    id: "pour-over-history-last-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/history/pour-over/last",
    summary: "Get the latest Pour Over brew record",
    response: "json",
    notes: "404 when there are no records.",
  },
  {
    id: "pour-over-files-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/history/pour-over/files/{path}",
    summary: "Browse Pour Over record files, or get one as JSON",
    params: [
      {
        name: "path",
        in: "path",
        type: "string",
        description:
          "Empty for the root folder, a folder, or a record file (the .zst suffix may be omitted)",
      },
    ],
    response: "json",
    notes: "Folders answer at most 200 entries [{name, url}], newest first.",
  },
  {
    id: "pour-over-files-redirect-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/history/pour-over/files",
    summary: "Redirect to the Pour Over file listing",
    response: "json",
    notes:
      "301 to /api/v1/history/pour-over/files/. No CORS headers on the redirect; call the trailing-slash path instead.",
  },
  {
    id: "pour-over-profile-list-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/pour-over/profile/list",
    summary: "List Pour Over profiles",
    response: "json",
    notes:
      "503 when Pour Over profiles are unavailable on this build (see pour_over_profiles_supported in /api/v1/machine). Save them with POST /api/v1/profile/save and brew_type 'pour_over'.",
  },
  {
    id: "pour-over-profile-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/pour-over/profile/get/{id}",
    summary: "Get one Pour Over profile",
    params: [
      PROFILE_ID_PARAM,
      {
        name: "include_image",
        in: "query",
        type: "boolean",
        default: "true",
      },
    ],
    response: "json",
  },
  {
    id: "pour-over-profile-image-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/pour-over/profile/image/{id}",
    summary: "Get a Pour Over profile's image",
    params: [PROFILE_ID_PARAM],
    response: "image",
    notes: "JPEG; 404 when the profile has no image.",
  },
  {
    id: "pour-over-profile-delete",
    group: "Pour-over",
    method: "DELETE",
    path: "/api/v1/pour-over/profile/delete/{id}",
    summary: "Delete a Pour Over profile",
    params: [PROFILE_ID_PARAM],
    response: "json",
    danger: "destructive",
    notes:
      "Optional header X-Change-Id (not allowed cross-origin by the CORS headers).",
  },
  {
    id: "pour-over-profile-schema-get",
    group: "Pour-over",
    method: "GET",
    path: "/api/v1/pour-over/profile/schema",
    summary: "Get the Pour Over profile JSON schema",
    response: "json",
  },

  // Wi-Fi
  {
    id: "wifi-config-get",
    group: "Wi-Fi",
    method: "GET",
    path: "/api/v1/wifi/config",
    summary: "Get Wi-Fi mode, hotspot settings, connection status and health",
    response: "json",
    notes:
      "Includes the hotspot password and the known networks. In emulation without networking this route is replaced by a fake config.",
  },
  {
    id: "wifi-config-post",
    group: "Wi-Fi",
    method: "POST",
    path: "/api/v1/wifi/config",
    summary: "Switch Wi-Fi mode or change the hotspot password",
    body: { kind: "json", example: { mode: "CLIENT" } },
    response: "json",
    danger: "destructive",
    notes:
      "mode is 'AP' (hotspot) or 'CLIENT'; apPassword sets the hotspot password. Switching to AP drops the machine off your network. Answers the new config.",
  },
  {
    id: "wifi-config-qr-get",
    group: "Wi-Fi",
    method: "GET",
    path: "/api/v1/wifi/config/qr.png",
    summary: "Get a QR code to join the hotspot or open the machine",
    response: "image",
    notes:
      "In AP mode it encodes the hotspot credentials; otherwise http://<machine ip>:8080 (the backend PORT, not nginx's 80).",
  },
  {
    id: "wifi-list-get",
    group: "Wi-Fi",
    method: "GET",
    path: "/api/v1/wifi/list",
    summary: "Scan and list nearby Wi-Fi networks",
    response: "json",
    notes:
      "Triggers a rescan and can take several seconds. Answers [{type, security, ssid, signal, rate, in_use}] by signal. Fake list in emulation without networking.",
  },
  {
    id: "wifi-connect-post",
    group: "Wi-Fi",
    method: "POST",
    path: "/api/v1/wifi/connect",
    summary: "Connect to a Wi-Fi network",
    body: {
      kind: "json",
      example: { ssid: "MyNetwork", password: "network-password", type: "PSK" },
    },
    response: "json",
    danger: "caution",
    notes:
      "type is OPEN, PSK (default) or SAE; 802.1X is not supported. password may be omitted for a known network. The machine leaves its current network or hotspot. Errors answer 400 with a code.",
  },
  {
    id: "wifi-repair-post",
    group: "Wi-Fi",
    method: "POST",
    path: "/api/v1/wifi/repair",
    summary: "Run the Wi-Fi repair routine",
    response: "json",
    danger: "caution",
    notes:
      "No body. Answers {status, health}; may briefly drop the connection.",
  },
  {
    id: "wifi-delete-post",
    group: "Wi-Fi",
    method: "POST",
    path: "/api/v1/wifi/delete",
    summary: "Forget a saved Wi-Fi network",
    body: { kind: "json", example: { ssid: "MyNetwork" } },
    response: "json",
    danger: "destructive",
  },

  // Updates
  {
    id: "os-update-status-get",
    group: "Updates",
    method: "GET",
    path: "/api/v1/machine/OS_update_status",
    summary: "Get the OS update progress",
    response: "json",
    notes:
      "Answers {progress, status, info}; status is IDLE, DOWNLOADING, INSTALLING, COMPLETE or FAILED. Live updates arrive as the socket event 'OSUpdate'.",
  },

  // Sounds
  {
    id: "sounds-list-get",
    group: "Sounds",
    method: "GET",
    path: "/api/v1/sounds/list",
    summary: "List the sound names of the current theme",
    response: "json",
  },
  {
    id: "sounds-play-get",
    group: "Sounds",
    method: "GET",
    path: "/api/v1/sounds/play/{sound}",
    summary: "Play a sound",
    params: [
      {
        name: "sound",
        in: "path",
        required: true,
        type: "string",
        options: SOUND_NAMES,
      },
    ],
    response: "json",
    notes:
      "Answers ok without playing when sounds are disabled; 404 for a name the theme lacks.",
  },
  {
    id: "sounds-theme-list-get",
    group: "Sounds",
    method: "GET",
    path: "/api/v1/sounds/theme/list",
    summary: "List the available sound themes",
    response: "json",
  },
  {
    id: "sounds-theme-get",
    group: "Sounds",
    method: "GET",
    path: "/api/v1/sounds/theme/get",
    summary: "Get the current sound theme",
    response: "text",
    notes:
      "Body is the bare theme name (e.g. default), not JSON, although Content-Type says application/json.",
  },
  {
    id: "sounds-theme-set-get",
    group: "Sounds",
    method: "GET",
    path: "/api/v1/sounds/theme/set/{theme}",
    summary: "Set the sound theme",
    params: [
      {
        name: "theme",
        in: "path",
        required: true,
        type: "string",
        default: "default",
        description: "A name from /api/v1/sounds/theme/list",
      },
    ],
    response: "json",
    danger: "caution",
  },
  {
    id: "sounds-theme-set-post",
    group: "Sounds",
    method: "POST",
    path: "/api/v1/sounds/theme/set/{theme}",
    summary: "Set the sound theme (POST alias)",
    params: [
      {
        name: "theme",
        in: "path",
        required: true,
        type: "string",
        default: "default",
        description: "A name from /api/v1/sounds/theme/list",
      },
    ],
    response: "json",
    danger: "caution",
  },
  {
    id: "sounds-theme-upload-post",
    group: "Sounds",
    method: "POST",
    path: "/api/v1/sounds/theme/upload",
    summary: "Upload a sound theme zip",
    body: { kind: "file", field: "file", accept: ".zip" },
    response: "text",
    danger: "caution",
    notes:
      "The zip must hold exactly one root folder (the theme name) with a valid config.json. Success is plain text; errors are JSON. Through nginx, uploads over 1 MB likely hit nginx's default body limit (413).",
  },

  // Notifications
  {
    id: "notifications-get",
    group: "Notifications",
    method: "GET",
    path: "/api/v1/notifications",
    summary: "List notifications",
    params: [
      {
        name: "acknowledged",
        in: "query",
        type: "boolean",
        default: "false",
        description: "Also include acknowledged notifications",
      },
    ],
    response: "json",
  },
  {
    id: "notifications-acknowledge-post",
    group: "Notifications",
    method: "POST",
    path: "/api/v1/notifications/acknowledge",
    summary: "Answer a notification",
    body: {
      kind: "json",
      example: { id: "<notification id>", response: "Ok" },
    },
    response: "json",
    danger: "caution",
    notes:
      "response is one of the notification's responses (Ok, Yes, No, Update, Skip, Abort). Some answers matter: Yes on 'Allow Wifi provisioning for 3 minutes?' opens BLE Wi-Fi provisioning. 404 for an unknown or already acknowledged id.",
  },
  {
    id: "notifications-post",
    group: "Notifications",
    method: "POST",
    path: "/api/v1/notifications",
    summary: "Answer a notification (alias of /notifications/acknowledge)",
    body: {
      kind: "json",
      example: { id: "<notification id>", response: "Ok" },
    },
    response: "json",
    danger: "caution",
    notes: "Same handler as /notifications/acknowledge.",
  },
  {
    id: "notifications-acknowledge-get",
    group: "Notifications",
    method: "GET",
    path: "/api/v1/notifications/acknowledge",
    summary: "List notifications (alias of GET /notifications)",
    params: [
      {
        name: "acknowledged",
        in: "query",
        type: "boolean",
        default: "false",
      },
    ],
    response: "json",
    notes: "Same handler as /notifications.",
  },

  // Reports
  {
    id: "reports-preflight-get",
    group: "Reports",
    method: "GET",
    path: "/api/v1/reports/preflight",
    summary: "Check whether a bug report can be collected and uploaded",
    params: [
      {
        name: "probe",
        in: "query",
        type: "string",
        description:
          "https URL the machine should reach (HEAD request); repeatable, up to 4",
      },
    ],
    response: "json",
    notes:
      "Answers {ok, blockers, machineID, disk, collectionInProgress, network}.",
  },
  {
    id: "reports-create-post",
    group: "Reports",
    method: "POST",
    path: "/api/v1/reports/create",
    summary: "Collect a bug report draft (logs, status, debug shots)",
    body: { kind: "json", example: { issueTime: 1761240000 } },
    response: "json",
    danger: "caution",
    notes:
      "Body is optional: either issueTime (epoch seconds, collects the window around it) or localID (a dispatched report), not both. Collection takes a while; answers {localID, machineID}. 409 while another collection runs, 507 with less than 200 MB free.",
  },
  {
    id: "reports-request-post",
    group: "Reports",
    method: "POST",
    path: "/api/v1/reports/request",
    summary: "Get a new report localID for a mobile-app dispatch",
    response: "json",
    notes: "Must be sent with an empty body (400 otherwise). Stores nothing.",
  },
  {
    id: "reports-dispatch-get",
    group: "Reports",
    method: "GET",
    path: "/api/v1/reports/dispatch",
    summary: "List dispatched reports still waiting for the Dial",
    response: "json",
    notes:
      "Answers {content: [...]}, same payload as the 'upload_report' socket event.",
  },
  {
    id: "reports-dispatch-post",
    group: "Reports",
    method: "POST",
    path: "/api/v1/reports/dispatch",
    summary: "Hand a report over to the Dial for collection and upload",
    body: {
      kind: "json",
      example: {
        localID: EXAMPLE_LOCAL_ID,
        ticket: 1234,
        issueTime: 1761240000,
        description: "Shot stopped early",
        name: "Jane Doe",
        email: "jane@example.com",
      },
    },
    response: "json",
    danger: "caution",
    notes:
      "localID and ticket (integer) are required; issueTime, description, name, email are optional. Answers 202 and emits 'upload_report' to the Dial. 409 for a duplicate localID.",
  },
  {
    id: "reports-list-get",
    group: "Reports",
    method: "GET",
    path: "/api/v1/reports/list",
    summary: "List bug reports, newest first",
    params: [
      {
        name: "page",
        in: "query",
        required: true,
        type: "number",
        default: "0",
      },
      {
        name: "size",
        in: "query",
        required: true,
        type: "number",
        default: "20",
      },
      {
        name: "filter",
        in: "query",
        type: "string",
        description:
          "FIQL on report columns, e.g. status==draft or status==submitted;ticketNumber=gt=100 (, = or, ; = and, * wildcard)",
      },
    ],
    response: "json",
    notes: "Answers {content, size, page, hasMore}.",
  },
  {
    id: "reports-draft-get",
    group: "Reports",
    method: "GET",
    path: "/api/v1/reports/draft/{localID}",
    summary: "Download a report as a tar.zst archive",
    params: [REPORT_LOCAL_ID_PARAM],
    response: "binary",
    notes: "Served as <localID>.zstd. Works for drafts and finalized reports.",
  },
  {
    id: "reports-draft-put",
    group: "Reports",
    method: "PUT",
    path: "/api/v1/reports/draft/{localID}",
    summary:
      "Update a report draft's description, ticket or attached debug shots",
    params: [REPORT_LOCAL_ID_PARAM],
    body: {
      kind: "json",
      example: {
        description: "Shot stopped early",
        ticket: 1234,
        attachments: {
          debugFiles: { user: ["2026-10-23/08:15:02.shot.json.zst"] },
        },
      },
    },
    response: "json",
    danger: "caution",
    notes:
      "Allowed keys: description, baseEventID, ticket, multimedia, attachments.debugFiles.user (other keys answer 403). Answers the updated report_info.",
  },
  {
    id: "reports-draft-delete",
    group: "Reports",
    method: "DELETE",
    path: "/api/v1/reports/draft/{localID}",
    summary: "Delete a report and its files",
    params: [REPORT_LOCAL_ID_PARAM],
    response: "json",
    danger: "destructive",
    notes: "Must have no body. Answers 204.",
  },
  {
    id: "reports-submit-post",
    group: "Reports",
    method: "POST",
    path: "/api/v1/reports/submit",
    summary: "Mark a report as submitted",
    body: {
      kind: "json",
      example: {
        localID: EXAMPLE_LOCAL_ID,
        eventID: "sentry-event-id",
        ticket: 1234,
      },
    },
    response: "text",
    danger: "caution",
    notes:
      "localID and eventID are required; submissionTime (epoch seconds) and ticket (integer or null) are optional. Answers 200 with an empty body.",
  },

  // Serial / firmware
  {
    id: "serial-form-get",
    group: "Serial / firmware",
    method: "GET",
    path: "/api/v1/serial",
    summary: "Get the HTML form for writing the machine's serial number",
    response: "text",
  },
  {
    id: "serial-post",
    group: "Serial / firmware",
    method: "POST",
    path: "/api/v1/serial",
    summary: "Write serial number, color, batch and build date to the ESP32",
    body: {
      kind: "text",
      example: "color=black&serial=000123&batch_number=1&build_date=2026-10-23",
    },
    response: "text",
    danger: "destructive",
    notes:
      "Form fields, not JSON: send with Content-Type application/x-www-form-urlencoded. Overwrites the machine identity in the ESP32 NVS. Answers HTML text.",
  },
  {
    id: "scale-calibrate-get",
    group: "Serial / firmware",
    method: "GET",
    path: "/api/v1/scaleCalibrate",
    summary: "Start the load-cell master calibration",
    response: "text",
    danger: "caution",
    notes:
      "Factory procedure (same as the scale_master_calibration action): stops heater and motor, needs an Acaia load cell, do not unplug the scale. Answers 200 with an empty body.",
  },
  {
    id: "firmware-update-post",
    group: "Serial / firmware",
    method: "POST",
    path: "/api/v1/update/firmware",
    summary: "Upload ESP32 firmware and flash it",
    params: [
      {
        name: "chip",
        in: "query",
        required: true,
        type: "string",
        options: ["ESP32S3", "ESP32"],
        default: "ESP32S3",
      },
    ],
    body: { kind: "file", field: "file", accept: ".zip,.bin" },
    response: "text",
    danger: "destructive",
    notes:
      "A zip of the firmware folder, or one of firmware.bin, partitions.bin, bootloader.bin, boot_app0.bin. Flashing starts in the background after 'success'. Through nginx, files over 1 MB likely hit nginx's default body limit (413).",
  },

  // Smoke validation
  {
    id: "smoke-validation-get",
    group: "Smoke validation",
    method: "GET",
    path: "/api/v1/smoke-validation",
    summary: "Get the smoke validation status",
    response: "json",
    notes: LOCAL_ONLY,
  },
];
