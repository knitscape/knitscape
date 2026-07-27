export interface SavedScript {
  code: string;
  updatedAt: number;
}

export type LastOpened =
  | { type: "saved"; name: string }
  | { type: "example"; name: string };

const SCRIPTS_KEY = "knitbit:scripts";
const LAST_OPENED_KEY = "knitbit:lastOpened";

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded / storage unavailable — swallow.
  }
}

export function loadAllScripts(): Record<string, SavedScript> {
  const data = readJSON<Record<string, SavedScript>>(SCRIPTS_KEY);
  if (!data || typeof data !== "object") return {};
  const out: Record<string, SavedScript> = {};
  for (const [name, entry] of Object.entries(data)) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.code === "string" &&
      typeof entry.updatedAt === "number"
    ) {
      out[name] = { code: entry.code, updatedAt: entry.updatedAt };
    }
  }
  return out;
}

export function getScript(name: string): SavedScript | null {
  const all = loadAllScripts();
  return all[name] ?? null;
}

export function saveScript(name: string, code: string): void {
  const all = loadAllScripts();
  all[name] = { code, updatedAt: Date.now() };
  writeJSON(SCRIPTS_KEY, all);
}

export function deleteScript(name: string): void {
  const all = loadAllScripts();
  if (!(name in all)) return;
  delete all[name];
  writeJSON(SCRIPTS_KEY, all);
}

export function renameScript(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return false;
  const all = loadAllScripts();
  if (!(oldName in all)) return false;
  if (trimmed in all) return false;
  all[trimmed] = all[oldName];
  all[trimmed].updatedAt = Date.now();
  delete all[oldName];
  writeJSON(SCRIPTS_KEY, all);
  return true;
}

export function loadLastOpened(): LastOpened | null {
  const v = readJSON<LastOpened>(LAST_OPENED_KEY);
  if (!v || typeof v !== "object") return null;
  if (v.type === "saved" || v.type === "example") {
    if (typeof v.name === "string" && v.name.length > 0) return v;
  }
  return null;
}

export function saveLastOpened(v: LastOpened): void {
  writeJSON(LAST_OPENED_KEY, v);
}

export function nextUntitledName(
  scripts: Record<string, SavedScript>
): string {
  if (!("Untitled" in scripts)) return "Untitled";
  for (let i = 2; i < 10000; i++) {
    const name = `Untitled ${i}`;
    if (!(name in scripts)) return name;
  }
  return `Untitled ${Date.now()}`;
}
