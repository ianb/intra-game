/* Parses a string that has <tag attrs...>...</tag>, but
   permissive */

export type TagType = {
  type: string;
  attrs: Record<string, string>;
  content: string;
  subTags?: TagType[];
};

export function parseTags(s: string, allowTags?: string[]): TagType[] {
  s = s.trim().replace(/^`+/, "").replace(/`+$/, "").trim();
  const root: TagType = { type: "root", attrs: {}, content: "" };
  const stack: { tag: TagType; startPos: number; contentStart: number }[] = [];
  let pos = 0;

  while (pos < s.length) {
    const restOfString = s.slice(pos);
    const nextMatch = restOfString.match(/<(\/)?([^\s>/]+)([^>]*?)(\/)?>/);
    if (!nextMatch) {
      // No more tags, the rest is text
      const text = s.slice(pos);
      const currentTag = stack.length > 0 ? stack[stack.length - 1].tag : root;
      currentTag.content += text;
      const trimmedText = text.trim();
      if (trimmedText) {
        if (!currentTag.subTags) {
          currentTag.subTags = [];
        }
        currentTag.subTags.push({
          type: "comment",
          attrs: {},
          content: trimmedText,
        });
      }
      pos = s.length;
      break;
    }

    const matchStart = pos + nextMatch.index!;
    const matchEnd = matchStart + nextMatch[0].length;
    const isEnd = !!nextMatch[1];
    const tagName = nextMatch[2];
    const tagAttrs = nextMatch[3];
    const isSelfClosing = !!nextMatch[4];

    // Text before the tag
    if (matchStart > pos) {
      const text = s.slice(pos, matchStart);
      const currentTag = stack.length > 0 ? stack[stack.length - 1].tag : root;
      currentTag.content += text;
      const trimmedText = text.trim();
      if (trimmedText) {
        if (!currentTag.subTags) {
          currentTag.subTags = [];
        }
        currentTag.subTags.push({
          type: "comment",
          attrs: {},
          content: trimmedText,
        });
      }
    }

    if (isEnd) {
      // Closing tag
      if (stack.length === 0) {
        console.warn("Unexpected closing tag", nextMatch[0]);
        pos = matchEnd;
        continue;
      }
      const currentItem = stack.pop()!;
      const currentTag = currentItem.tag;
      if (tagName === currentTag.type) {
        // Correct closing tag
        // Set content between contentStart and matchStart
        currentTag.content = s.slice(currentItem.contentStart, matchStart);
        // Append from startPos to matchEnd to parent content
        const parentTag = stack.length > 0 ? stack[stack.length - 1].tag : root;
        parentTag.content += s.slice(currentItem.startPos, matchEnd);
        pos = matchEnd;
        continue;
      } else {
        console.warn("Mismatched closing tag", nextMatch[0]);
        pos = matchEnd;
        continue;
      }
    }

    if (allowTags && !allowTags.includes(tagName)) {
      console.warn("Disallowed tag", nextMatch[0]);
      pos = matchEnd;
      continue;
    }

    // Opening tag
    const attrs = parseAttrs(tagAttrs);
    const newTag: TagType = { type: tagName, attrs, content: "" };

    // Append opening tag to parent content
    const parentTag = stack.length > 0 ? stack[stack.length - 1].tag : root;
    parentTag.content += s.slice(matchStart, matchEnd);

    // Add newTag to parent subTags
    if (!parentTag.subTags) {
      parentTag.subTags = [];
    }
    parentTag.subTags.push(newTag);

    if (!isSelfClosing) {
      // Push onto stack
      stack.push({ tag: newTag, startPos: matchStart, contentStart: matchEnd });
    } else {
      // Self-closing tag, content is empty
      newTag.content = "";
    }

    pos = matchEnd;
  }

  if (root.subTags) {
    cleanUpTags(root.subTags);
    return root.subTags;
  } else {
    return [];
  }
}

function parseAttrs(s: string): Record<string, string> {
  if (!s || !s.trim()) {
    return {};
  }
  const attrsText = s.trim();
  const attrs: Record<string, string> = {};
  Array.from(attrsText.matchAll(/([^=\s]+)="([^"]*)"/g)).forEach((match) => {
    const v = match[2];
    attrs[match[1].trim()] = v;
  });
  return attrs;
}

function cleanUpTags(tags: TagType[]): TagType[] {
  for (const tag of tags) {
    if (tag.subTags) {
      cleanUpTags(tag.subTags);
      tag.content = tag.content.trim();
      // Remove subTags if they only contain comments
      if (!tag.subTags.find((x) => x.type !== "comment")) {
        delete tag.subTags;
      }
    }
  }
  return tags;
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

export function serializeAttrs(
  attrs: Record<string, string>,
  omit?: OmitArgument
) {
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

export function unfoldTags(
  tags: TagType[],
  {
    ignoreContainers,
    ignoreTags,
    trimEmpty,
  }: {
    ignoreContainers?: string[];
    ignoreTags?: string[];
    trimEmpty?: string[];
  } = {}
): TagType[] {
  const todo = [...tags];
  const result: TagType[] = [];
  ignoreContainers = ignoreContainers || [];
  ignoreTags = ignoreTags || [];
  trimEmpty = trimEmpty || [];
  while (todo.length) {
    const tag = todo.shift()!;
    if (ignoreContainers.includes(tag.type)) {
      // Don't unfold these
      result.push(tag);
      continue;
    }
    if (trimEmpty.includes(tag.type) && !tag.content.trim()) {
      // Remove empty tags
      continue;
    }
    if (
      !tag.subTags ||
      !tag.subTags.find((x) => !ignoreTags.includes(x.type))
    ) {
      // Doesn't have anything relevant
      result.push(tag);
      continue;
    }
    const newSubTags = tag.subTags.filter((x) => !ignoreTags.includes(x.type));
    const unfoldTags = tag.subTags.filter((x) => ignoreTags.includes(x.type));
    const newTag = {
      ...tag,
      subTags: newSubTags,
      content: serializeTags(unfoldTags),
    };
    if (!trimEmpty.includes(tag.type) || newTag.content.trim()) {
      result.push(newTag);
    }
    todo.unshift(...unfoldTags);
  }
  return result;
}

if (typeof window !== "undefined") {
  (window as any).parseTags = parseTags;
  (window as any).serializeTags = serializeTags;
}
