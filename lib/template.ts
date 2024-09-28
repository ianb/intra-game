let nextId = 0;
function nextIdentifier() {
  nextId++;
  return `\${placeholder-${nextId}}`;
}

export function tmpl(strings: TemplateStringsArray | string[], ...args: any[]): string {
  const props = new Map();
  const parts = [];
  for (let i = 0; i < strings.length - 1; i++) {
    parts.push(strings[i]);
    const id = nextIdentifier();
    props.set(id, args[i]);
    parts.push(id);
  }
  parts.push(strings[strings.length - 1]);
  const template = parts.join("");
  return parseTemplate(dedent(template), props);
}

export function fillTemplate(template: string, evaluator: (_name: string) => any) {
  if (typeof template !== "string") {
    if (!template) {
      throw new Error("Template is null or undefined");
    }
    throw new Error(`Template is not a string: ${typeof template}`);
  }
  const parts = [];
  const subs = [];
  let match;
  const regex = /\{\{(.*?)\}\}/g;
  let pos = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(template))) {
    parts.push(template.slice(pos, match.index));
    subs.push(evaluator(match[1]));
    pos = match.index + match[0].length;
  }
  parts.push(template.slice(pos));
  return tmpl(parts, ...subs);
}

export function fillTemplateSimple(template: string, values: Record<string, any>) {
  return fillTemplate(template, (name) => values[name]);
}

function parseTemplate(template: string, props: Map<string, any>) {
  const tailingPunctuationMatcher = /(\$\{placeholder-\d+\})([.,])/g;
  template = template.replace(tailingPunctuationMatcher, (match, name, punctuation) => {
    const value = props.get(name);
    if (value && typeof value === "string" && /[!;,.?]$/.test(value)) {
      return name;
    }
    return name + punctuation;
  });
  const markdownListMatcher = /^(\s*)(\d+\.|\*|-)\s+\.\.\.(\$\{placeholder-\d+\})/gm;
  template = template.replace(markdownListMatcher, (match, indent, bullet, name) => {
    const value = props.get(name);
    if (!value) {
      return `${indent}${bullet} [No value]`;
    }
    if (!Array.isArray(value)) {
      return `${indent}${bullet} [Not a list]`;
    }
    const filtered = value.filter((v) => !isEmpty(v));
    if (filtered.length === 0) {
      return `${indent}${bullet} [No values]`;
    }
    const numMatch = /^(\d)+/.exec(bullet);
    let num = -1;
    if (numMatch) {
      num = parseInt(numMatch[1], 10);
    }
    const newId = nextIdentifier();
    props.set(
      newId,
      filtered
        .map((v, i) => {
          if (num !== -1) {
            return `${indent}${num + i}. ${repr(v)}`;
          }
          return `${indent}${bullet} ${repr(v)}`;
        })
        .join("\n"),
    );
    return newId;
  });
  const conditionalMatcher = /\[\[([^]*?)\]\]/g;
  template = template.replace(conditionalMatcher, (match, inner) => {
    let found = false;
    let hasEmpty = false;
    // This really just sets found and hasEmpty:
    inner.replace(/(\$\{placeholder-\d+\})/g, (_varMatch: any, name: string) => {
      const value = props.get(name);
      if (isEmpty(value)) {
        hasEmpty = true;
      }
      found = true;
      return match;
    });
    if (!found) {
      // No variables found anywhere
      console.warn("No variables found in conditional", match);
      return match;
    }
    if (hasEmpty) {
      // One of the variables is empty
      return "";
    }
    return inner;
  });
  const loopMatcher = /(\n\s+)?\{\[([^]*?)(\n)?\]\}/g;
  template = template.replace(loopMatcher, (match, leading, inner, trailing) => {
    const values: any = {};
    let firstName;
    const notLoopVariables: string[] = [];
    // This just sets values, firstName, and notLoopVariables:
    Array.from(inner.matchAll(/(\$\{placeholder-\d+\})/g)).forEach((item: any) => {
      const name = item[1];
      const value = props.get(name);
      if (Array.isArray(value)) {
        values[name] = value;
        firstName = name;
      } else {
        notLoopVariables.push(name);
      }
    });
    if (!firstName) {
      // No list variables found
      console.warn("No list variables found in loop", match, "not arrays:", notLoopVariables);
      return match;
    }
    const number = values[firstName].length;
    const result = [];
    for (let i = 0; i < number; i++) {
      const resolved = new Map(props);
      for (const name of Object.keys(values)) {
        resolved.set(name, values[name][i]);
      }
      const loopValue = substituteTemplate(inner, resolved);
      result.push((leading || "") + loopValue + (trailing || ""));
    }
    return result.join("");
  });
  return substituteTemplate(template, props);
}

function substituteTemplate(template: string, props: any) {
  let result = template;
  for (const key of props.keys()) {
    result = result.replace(key, () => repr(props.get(key)));
  }
  result = result.replace(/\n\n\n+/g, "\n\n");
  result = result.trim();
  return result;
}

export function isEmpty(v: any) {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (v && v.isEmpty)
  );
}

export function repr(v: any): string {
  if (v === null || v === undefined) {
    return "[No value]";
  }
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map((x) => repr(x)).join(", ");
  }
  if (v.toString() === "[object Object]") {
    return JSON.stringify(v);
  }
  return v.toString();
}

export function dedent(template: string) {
  if (template === null || template === undefined) {
    throw new Error("Template is null or undefined");
  }
  const lines = template.split("\n");
  let firstLine = lines[0];
  if (firstLine.trim() === "") {
    firstLine = "";
  } else {
    firstLine = `${firstLine.trimEnd()}\n`;
  }
  lines.shift();
  while (lines.length && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  let indent = -1;
  for (const indentLine of lines) {
    const trimmed = indentLine.trimStart();
    if (trimmed) {
      const newIndent = indentLine.length - trimmed.length;
      if (indent === -1 || newIndent < indent) {
        indent = newIndent;
      }
    }
  }
  const result = lines.map((line) => line.slice(indent).trimEnd()).join("\n");
  return `${firstLine}${result}`;
}

class TemplateBool {
  value: any;
  constructor(value: any) {
    this.value = value;
  }

  toString() {
    return "";
  }

  get isEmpty() {
    return !this.value;
  }

  not() {
    return new TemplateBool(!this.value);
  }
}

export class EmptyError {
  message: string;
  isEmpty: boolean;
  constructor(message: string) {
    this.message = message;
    this.isEmpty = true;
  }

  toString() {
    return this.message;
  }
}

export const TemplateTrue = new TemplateBool(true);
export const TemplateFalse = new TemplateBool(false);
