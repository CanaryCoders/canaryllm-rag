import { describe, expect, test } from "bun:test";
import { extractText, htmlToText, markdownToText } from "../../src/parse";

describe("htmlToText", () => {
  test("strips tags, drops script/style, decodes entities", () => {
    const html =
      "<html><head><style>.x{}</style></head><body><h1>Title</h1>" +
      "<p>Hello &amp; welcome</p><script>evil()</script><p>Bye</p></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Title");
    expect(text).toContain("Hello & welcome");
    expect(text).toContain("Bye");
    expect(text).not.toContain("evil");
    expect(text).not.toContain("<");
  });

  test("turns block tags into paragraph breaks", () => {
    expect(htmlToText("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});

describe("markdownToText", () => {
  test("removes headings, emphasis, links and code", () => {
    const md = "# Heading\n\nSome **bold** and *italic* and `code` and [link](http://x).";
    const text = markdownToText(md);
    expect(text).toContain("Heading");
    expect(text).toContain("bold");
    expect(text).toContain("italic");
    expect(text).toContain("link");
    expect(text).not.toContain("#");
    expect(text).not.toContain("](");
    expect(text).not.toContain("`");
  });

  test("strips ordered and unordered list markers", () => {
    const text = markdownToText("- first\n- second\n\n1. one\n2. two");
    expect(text).toContain("first");
    expect(text).toContain("one");
    expect(text).not.toMatch(/^\s*[-*+]\s/m);
    expect(text).not.toMatch(/^\s*\d+\.\s/m);
  });
});

describe("extractText", () => {
  test("dispatches by format hint", () => {
    expect(extractText("<p>hi</p>", "html")).toBe("hi");
    expect(extractText("# h", "md")).toBe("h");
    expect(extractText("plain", "txt")).toBe("plain");
  });
});
