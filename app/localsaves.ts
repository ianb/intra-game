import type { StoryEventType } from "@/lib/types";
import { read, STORAGE_VERSION } from "@/lib/storage";

const LOCAL_PREFIX = "intra-save.";

function sluggify(title: string) {
  return title
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function uniqueSlug(slug: string) {
  let i = 1;
  let proposed = slug;
  while (localStorage.getItem(LOCAL_PREFIX + proposed)) {
    proposed = slug + "_" + i;
    i++;
  }
  return proposed;
}

export function save(title: string, value: StoryEventType[]) {
  const slug = uniqueSlug(sluggify(title));
  const save = {
    title,
    date: new Date().toISOString(),
    // Stamped so a later change to the stored shape can tell this apart from
    // what it writes itself; see lib/storage.ts.
    version: STORAGE_VERSION,
    value,
  };
  localStorage.setItem(LOCAL_PREFIX + slug, JSON.stringify(save));
  console.info(
    `Saved "${LOCAL_PREFIX + slug}":`,
    JSON.stringify(save).length,
    "bytes",
  );
}

export function listSaves() {
  const keys = Object.keys(localStorage);
  const saves = keys
    .filter((key) => key.startsWith(LOCAL_PREFIX))
    .map((key) => {
      const save = localStorage.getItem(key);
      if (!save) {
        throw new Error(`No save found for ${key}`);
      }
      const data = JSON.parse(save);
      return {
        title: data.title,
        slug: key.slice(LOCAL_PREFIX.length),
        date: new Date(data.date),
      };
    });
  return saves;
}

export function removeSave(slug: string) {
  localStorage.removeItem(LOCAL_PREFIX + slug);
}

export function load(slug: string): StoryEventType[] {
  const save = localStorage.getItem(LOCAL_PREFIX + slug);
  if (!save) {
    throw new Error(`No save found for ${slug}`);
  }
  const stored = JSON.parse(save);
  // The envelope has always had its own fields around `value`, so the version
  // lives beside them rather than wrapping them — `read` takes the payload.
  const result = read<StoryEventType[]>({
    version: stored.version ?? 0,
    value: stored.value,
  });
  if (!result.ok) {
    throw new Error(`Cannot load "${slug}": ${result.reason}`);
  }
  return result.value;
}
