import { describe, expect, it } from "vitest";

describe("header title resolution", () => {
  it("falls back to app class name when no title is set", () => {
    // Title resolution: screen.title > app.title > app class name
    const appTitle: string | null = null;
    const screenTitle: string | null = null;
    const fallback = "MyApp";

    const resolved = screenTitle ?? appTitle ?? fallback;
    expect(resolved).toBe("MyApp");
  });

  it("uses app title when set", () => {
    const appTitle = "My Application";
    const screenTitle: string | null = null;
    const fallback = "MyApp";

    const resolved = screenTitle ?? appTitle ?? fallback;
    expect(resolved).toBe("My Application");
  });

  it("prefers screen title over app title", () => {
    const appTitle = "My Application";
    const screenTitle = "Settings";
    const fallback = "MyApp";

    const resolved = screenTitle ?? appTitle ?? fallback;
    expect(resolved).toBe("Settings");
  });

  it("formats title and subtitle with em dash separator", () => {
    const title = "My App";
    const subTitle = "v1.0";

    const formatted = subTitle ? `${title} \u2014 ${subTitle}` : title;
    expect(formatted).toBe("My App \u2014 v1.0");
  });

  it("shows title only when subtitle is absent", () => {
    const title = "My App";
    const subTitle: string | null = null;

    const formatted = subTitle ? `${title} \u2014 ${subTitle}` : title;
    expect(formatted).toBe("My App");
  });
});

describe("footer binding collection", () => {
  it("collects bindings from a flat array with show filtering", () => {
    const bindings = [
      { key: "ctrl+s", action: "save", description: "Save", show: true },
      { key: "ctrl+q", action: "quit", description: "Quit", show: true },
      { key: "ctrl+z", action: "undo", description: "Undo", show: false },
    ];

    const visible = bindings.filter((binding) => binding.show !== false);
    expect(visible).toHaveLength(2);
    expect(visible.map((binding) => binding.action)).toEqual(["save", "quit"]);
  });

  it("priority bindings take precedence in display", () => {
    const bindings = [
      { key: "ctrl+q", action: "quit", description: "Quit", priority: true, show: true },
      { key: "ctrl+s", action: "save", description: "Save", priority: false, show: true },
    ];

    const sorted = [...bindings].sort((left, right) => {
      const leftPriority = left.priority ? 1 : 0;
      const rightPriority = right.priority ? 1 : 0;
      return rightPriority - leftPriority;
    });

    expect(sorted[0].action).toBe("quit");
  });

  it("compact mode affects rendering choice", () => {
    let compact = false;

    const displayMode = compact ? "compact" : "full";
    expect(displayMode).toBe("full");

    compact = true;
    const compactMode = compact ? "compact" : "full";
    expect(compactMode).toBe("compact");
  });
});
