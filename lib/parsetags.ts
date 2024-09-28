/* Parses a string that has <tag attrs...>...</tag>, but not nested and
   permissive */

export type TagType = {
  type: string;
  attrs: Record<string, string>;
  content: string;
};

export function parseTags(s: string, allowTags?: string[]): TagType[] {
  s = s.trim().replace(/^`+/, "").replace(/`+$/, "").trim();
  const parts: TagType[] = [];
  let openTag = "";
  function appendText(text: string) {
    if (openTag) {
      parts[parts.length - 1].content += text;
    } else {
      parts.push({
        type: "comment",
        content: text,
        attrs: {},
      });
    }
  }
  do {
    const nextMatch = s.match(/<(\/)?([^\s>/]+)([^>]*?)(\/)?>/);
    if (!nextMatch) {
      appendText(s);
      break;
    }
    const endIndex = nextMatch.index! + nextMatch[0].length;
    const isEnd = !!nextMatch[1];
    const tagName = nextMatch[2];
    const tagAttrs = nextMatch[3];
    const isSelfClosing = !!nextMatch[4];
    let invalidTag = false;
    if (allowTags && !allowTags.includes(tagName)) {
      console.warn(
        "Disallowed tag",
        nextMatch[0],
        `allowed: ${allowTags.join(", ")}`
      );
      invalidTag = true;
    } else if (isEnd && !openTag) {
      console.warn(
        "Unexpected closing tag",
        nextMatch[0],
        `expected </${openTag}>`
      );
      invalidTag = true;
    } else if (isEnd && openTag !== tagName) {
      console.warn(
        "Mismatched closing tag",
        nextMatch[0],
        `expected </${openTag}>`
      );
      invalidTag = true;
    }
    if (invalidTag) {
      const text = s.slice(0, endIndex);
      appendText(text);
      s = s.slice(endIndex);
      continue;
    }
    if (isEnd) {
      const text = s.slice(0, nextMatch.index!);
      appendText(text);
      openTag = "";
      s = s.slice(endIndex);
      continue;
    }
    const leading = s.slice(0, nextMatch.index!).trim();
    if (leading) {
      appendText(leading);
    }
    const attrs = parseAttrs(tagAttrs);
    parts.push({
      type: tagName,
      attrs,
      content: "",
    });
    s = s.slice(endIndex);
    if (!isSelfClosing) {
      openTag = tagName;
    }
  } while (s.trim());
  for (const p of parts) {
    p.content = p.content.trim();
  }
  return parts;
}

function parseAttrs(s: string): Record<string, string> {
  if (!s || !s.trim()) {
    return {};
  }
  const attrsText = s.trim();
  const attrs: any = {};
  Array.from(attrsText.matchAll(/([^=\s]+)="([^"]*)"/g)).forEach((match) => {
    const v = match[2];
    // if (v.startsWith("[") && v.endsWith("]")) {
    //   v = JSON.parse(v);
    // } else if (v.startsWith("{") && v.endsWith("}")) {
    //   v = JSON.parse(v);
    // }
    attrs[match[1].trim()] = v;
  });
  return attrs;
}

export function serializeTags(tags: TagType[], omit?: OmitArgument) {
  if (!tags) {
    console.warn("Got serializeTags with no tags");
    return "";
  }
  const lines = [];
  for (const tag of tags) {
    if (!tag) {
      console.warn("Got serializeTags with no tag", tags);
      continue;
    }
    lines.push(`<${tag.type}${serializeAttrs(tag.attrs, omit)}>`);
    lines.push(tag.content || "");
    lines.push(`</${tag.type}>\n`);
  }
  return lines.join("\n");
}

type OmitArgument =
  | null
  | string
  | string[]
  | ((_key: string, _value: string) => boolean);

function serializeAttrs(attrs: Record<string, string>, omit?: OmitArgument) {
  const result = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (omit && Array.isArray(omit) && omit.includes(key)) {
      continue;
    }
    if (omit && typeof omit === "function" && omit(key, value)) {
      continue;
    }
    if (omit && typeof omit === "string" && key === omit) {
      continue;
    }
    let v = value;
    if (value && Array.isArray(value)) {
      v = JSON.stringify(value);
    } else if (value && typeof value === "object") {
      v = JSON.stringify(value);
    }
    result.push(` ${key}="${v}"`);
  }
  return result.join("");
}

export function addAttributesToTags(
  tags: TagType[],
  attrs: Record<string, string>
): TagType[] {
  return tags.map((tag) => {
    return {
      ...tag,
      attrs: { ...tag.attrs, ...attrs },
    };
  });
}

if (typeof window !== "undefined") {
  (window as any).parseTags = parseTags;
  (window as any).serializeTags = serializeTags;
}
