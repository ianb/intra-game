import { describe, it, expect } from "vitest";
import { parseTags, TagType, unfoldTags } from "../lib/parsetags";
import { tmpl } from "../lib/template";

function expectTag(
  tag: TagType,
  expectedType: string,
  expectedAttrs: Record<string, string>,
  expectedContent: string
) {
  expect(tag.type).toBe(expectedType);
  expect(tag.attrs).toEqual(expectedAttrs);
  expect(tag.content).toBe(expectedContent);
}

describe("parseTags with simpler helpers", () => {
  it("parses a simple tag with content", () => {
    const input = "<div>Hello</div>";
    const result = parseTags(input);
    expect(result.length).toBe(1);
    expectTag(result[0], "div", {}, "Hello");
  });

  it("parses nested tags", () => {
    const input = "<div><span>Hello</span> world</div>";
    const result = parseTags(input);
    expect(result.length).toBe(1);
    expectTag(result[0], "div", {}, "<span>Hello</span> world");

    const div = result[0];
    expect(div.subTags?.length).toBe(2);

    expectTag(div.subTags![0], "span", {}, "Hello");
    expectTag(div.subTags![1], "comment", {}, "world");
  });

  it("handles attributes", () => {
    const input = `<input type="text" value="Hello" />`;
    const result = parseTags(input);
    expect(result.length).toBe(1);
    expectTag(result[0], "input", { type: "text", value: "Hello" }, "");
  });

  it("handles self-closing tags with no attributes", () => {
    const input = `<br/>`;
    const result = parseTags(input);
    expectTag(result[0], "br", {}, "");
  });

  it("ignores disallowed tags if allowTags is provided", () => {
    const input = `<div>Allowed content</div><script>alert('x');</script>`;
    const result = parseTags(input, ["div"]);
    console.log("result", result);
    expect(result.length).toBe(2);
    expectTag(result[0], "div", {}, "Allowed content");
    expectTag(result[1], "comment", {}, "alert('x');");
  });

  it("handles mismatched tags and warns", () => {
    const input = `<div><span>Test</div></span>`;
    const result = parseTags(input);
    expect(result.length).toBe(1);
    const div = result[0];
    expect(div.type).toBe("div");
    expect(div.content).toContain("Test");
  });

  it("parses text nodes (comments) correctly", () => {
    const input = `Before<div>Inside</div>After`;
    const result = parseTags(input);
    expect(result.length).toBe(3);

    expectTag(result[0], "comment", {}, "Before");
    expectTag(result[1], "div", {}, "Inside");
    expectTag(result[2], "comment", {}, "After");
  });

  it("trims unnecessary backticks and surrounding whitespace", () => {
    const input = "```\n  <div>Trimmed</div>\n```";
    const result = parseTags(input);
    expectTag(result[0], "div", {}, "Trimmed");
  });

  it("auto-closes unclosed tags at the end", () => {
    const input = `<div><span>Open`;
    const result = parseTags(input);
    expect(result.length).toBe(1);
    const div = result[0];
    expect(div.type).toBe("div");
    expect(div.subTags?.length).toBe(1);
    expect(div.subTags![0].type).toBe("span");
    expect(div.subTags![0].content).toContain("Open");
  });

  it("parses multiple sibling tags", () => {
    const input = `<p>One</p><p>Two</p>`;
    const result = parseTags(input);
    expect(result.length).toBe(2);
    expectTag(result[0], "p", {}, "One");
    expectTag(result[1], "p", {}, "Two");
  });
});

describe("unfoldTags", () => {
  it("context example", () => {
    const input = tmpl`
    <context>
    question answering
    </context>

    <dialog character="Ama">
    para1

    para2_start <set attr="player.profession">internet troll</set> para2_end
    </dialog>
    `;
    const rawResult = parseTags(input);
    console.log("raw result", rawResult);
    let result = unfoldTags(rawResult, {
      // We don't want to unfold this, because it's for planning, not action:
      ignoreContainers: ["context"],
      // These sometimes are produced without content, but then they are meaningless:
      trimEmpty: ["dialog", "description"],
    });
    console.log("unfolded result", result);
    if (result.length === 1 && result[0].type === "context") {
      // This happens sometimes when it puts *everything* in a context tag. We don't always want to look inside context but if there's only context then we do...
      result = unfoldTags(parseTags(result[0].content), {});
      console.log("double unfolded result", result);
    }
    expect(result.length).toBe(3);
    expectTag(result[0], "context", {}, "question answering");
    expectTag(
      result[1],
      "dialog",
      { character: "Ama" },
      "para1\n\npara2_start\npara2_end"
    );
    expectTag(
      result[2],
      "set",
      { attr: "player.profession" },
      "internet troll"
    );
  });
});
