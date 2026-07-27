export interface Example {
  name: string;
  code: string;
}

const rawModules = import.meta.glob("./examples/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function filenameToName(path: string): string {
  const base = path.split("/").pop()!.replace(/\.js$/, "");
  return base
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const EXAMPLES: Example[] = Object.entries(rawModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, code]) => ({
    name: filenameToName(path),
    code,
  }));
