import React from "react";
import { Text } from "ink";
import { observer } from "mobx-react-lite";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { App, Header, Static, runTest, useTextual, type TestSession } from "../src/index.js";
import {
  NO_TITLE_OVERRIDE,
  resolveTitle,
} from "../src/framework/title-resolution.js";

// [LAW:behavior-not-structure] Every expectation below is a row of glyphs a
// user could read off the screen, or a widget they could query — never a call
// the Header happens to make on the way there.
//
// The two full-row literals are transcribed from the committed Python
// baselines, visual-tests/snapshots/python/header_default.txt and
// header_with_subtitle.txt, which is why they are stated cell-for-cell rather
// than assembled from the same constants the component uses. A test that
// rebuilt the row from HEADER_ICON_WIDTH and friends would agree with the
// component by construction and would have nothing left to catch.
const BASELINE_DEFAULT_ROW =
  " ⭘                              My Application                                  ";
const BASELINE_SUBTITLE_ROW =
  " ⭘                      My Application — Status: ready                          ";

const BAR_WIDTH = 80;

function headerRow(session: TestSession): string {
  return stripAnsi(session.lastFrame() ?? "").split("\n")[0];
}

async function mountHeader(appProps: {
  title?: string;
  subTitle?: string;
}): Promise<TestSession> {
  return runTest(
    <>
      <Header />
      <Static content="Body content" />
    </>,
    { appProps },
  );
}

describe("resolveTitle", () => {
  it("lets a screen's title win and its silence fall through", () => {
    const app = { title: "My Application", subTitle: "Status: ready" };

    expect(resolveTitle({ title: "Settings", subTitle: null }, app)).toEqual({
      title: "Settings",
      subTitle: "Status: ready",
    });
    expect(resolveTitle(NO_TITLE_OVERRIDE, app)).toEqual(app);
  });

  it("treats an empty screen title as an override, not as silence", () => {
    // Both fields go through the same `??`, so covering only one of them lets a
    // regression on the other through every test in this file.
    expect(
      resolveTitle({ title: "", subTitle: null }, { title: "My Application", subTitle: "" }),
    ).toEqual({ title: "", subTitle: "" });
  });

  it("treats an empty screen sub-title as an override, not as silence", () => {
    // The distinction the `string | null` type exists to preserve: a screen
    // that deliberately shows no sub-title must be able to clear the app's,
    // which `screen.subTitle || app.subTitle` would silently undo.
    expect(
      resolveTitle({ title: null, subTitle: "" }, { title: "App", subTitle: "Status: ready" }),
    ).toEqual({ title: "App", subTitle: "" });
  });
});

describe("Header display", () => {
  it("paints the app title centred across the full bar", async () => {
    const session = await mountHeader({ title: "My Application" });

    expect(headerRow(session)).toBe(BASELINE_DEFAULT_ROW);
    session.unmount();
  });

  it("joins title and sub-title with an em dash", async () => {
    const session = await mountHeader({
      title: "My Application",
      subTitle: "Status: ready",
    });

    expect(headerRow(session)).toBe(BASELINE_SUBTITLE_ROW);
    session.unmount();
  });

  it("shows the title alone when no sub-title is set", async () => {
    const session = await mountHeader({ title: "My Application" });

    expect(headerRow(session)).toContain("My Application");
    expect(headerRow(session)).not.toContain("—");
    session.unmount();
  });

  it("renders the title inside a queryable Static-derived HeaderTitle", async () => {
    const session = await mountHeader({ title: "My Application" });
    await session.app.whenIdle();

    expect(session.app.findWidgets("HeaderTitle")).toHaveLength(1);
    // The spec calls HeaderTitle a Static, which is only true if `Static { … }`
    // rules reach it — i.e. if it matches the Static selector too.
    expect(session.app.findWidgets("Static").map((widget) => widget.typeName)).toContain(
      "HeaderTitle",
    );
    session.unmount();
  });

  it("keeps the bar exactly one screen wide when the title overflows it", async () => {
    const session = await mountHeader({ title: "T".repeat(200) });
    const row = headerRow(session);

    expect([...row]).toHaveLength(BAR_WIDTH);
    // Truncation is visible rather than silent: the title is cut with an
    // ellipsis instead of pushing the reserved clock space off the row.
    expect(row).toContain("…");
    session.unmount();
  });
});

describe("Header title resolution", () => {
  it("falls back to the app class name when nothing sets a title", async () => {
    class HeaderlessApp extends App {}

    expect(new HeaderlessApp().title).toBe("HeaderlessApp");

    const session = await mountHeader({});
    expect(headerRow(session)).toContain("App");
    session.unmount();
  });

  it("prefers the screen title over the app title", async () => {
    const session = await mountHeader({ title: "My Application" });
    session.app.screenTitle = "Settings";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("Settings");
    expect(headerRow(session)).not.toContain("My Application");
    session.unmount();
  });

  it("uses the app title while the screen has no opinion", async () => {
    const session = await mountHeader({ title: "My Application" });

    expect(session.app.screenTitle).toBeNull();
    expect(headerRow(session)).toContain("My Application");
    session.unmount();
  });

  it("lets an empty screen title clear the app's, on screen", async () => {
    const session = await mountHeader({ title: "My Application" });
    expect(headerRow(session)).toContain("My Application");

    session.app.screenTitle = "";
    await session.app.whenIdle();

    // A blank title region, not a fall back to the app's title.
    expect(headerRow(session)).not.toContain("My Application");
    expect([...headerRow(session)]).toHaveLength(BAR_WIDTH);
    session.unmount();
  });

  it("lets an empty screen sub-title clear the app's, on screen", async () => {
    // The rendered counterpart of the `resolveTitle` unit test above. Without
    // it, `override.subTitle || app.subTitle` passes everything that draws a
    // Header, and only the pure test stands between that and a silent
    // regression — which is thin cover for the distinction the whole
    // `string | null` override type exists to make.
    const session = await mountHeader({
      title: "My Application",
      subTitle: "Status: ready",
    });
    expect(headerRow(session)).toContain("Status: ready");

    session.app.screenSubTitle = "";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("My Application");
    expect(headerRow(session)).not.toContain("Status: ready");
    expect(headerRow(session)).not.toContain("—");
    session.unmount();
  });

  it("prefers the screen sub-title over the app sub-title", async () => {
    const session = await mountHeader({
      title: "My Application",
      subTitle: "Status: ready",
    });
    session.app.screenSubTitle = "Settings mode";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("My Application — Settings mode");
    session.unmount();
  });
});

// A minimal reactive consumer of the public getter, standing in for any
// observer component a user might write against it.
const ScreenTitleProbe = observer(function ScreenTitleProbe(): React.JSX.Element {
  const app = useTextual();

  return <Text>{`screen:${app.screenTitle ?? "none"}`}</Text>;
});

describe("screen title API", () => {
  it("stays live for an observer reading app.screenTitle directly", async () => {
    // The regression this guards: reading `app.screen.title` returns the right
    // string but never notifies, because `activeScreen` is a computed that
    // hands back the same Screen object after an in-place retitle. Asserting
    // the getter outside a reaction passes either way — only a real observer
    // separates a correct read path from a stale one.
    const session = await runTest(<ScreenTitleProbe />, {});
    expect(stripAnsi(session.lastFrame() ?? "")).toContain("screen:none");

    session.app.screenTitle = "Settings";
    await session.app.whenIdle();

    expect(stripAnsi(session.lastFrame() ?? "")).toContain("screen:Settings");
    session.unmount();
  });

  it("takes a TITLE declared on the screen component", async () => {
    function SettingsScreen(): React.JSX.Element {
      return <Header />;
    }
    SettingsScreen.TITLE = "Settings";
    SettingsScreen.SUB_TITLE = "Preferences";

    const session = await mountHeader({ title: "My Application" });
    session.app.pushScreen(<SettingsScreen />);
    await session.app.whenIdle();

    expect(session.app.screenTitle).toBe("Settings");
    expect(headerRow(session)).toContain("Settings — Preferences");
    session.unmount();
  });

  it("lets a push-time option beat the screen's declared TITLE", async () => {
    function SettingsScreen(): React.JSX.Element {
      return <Header />;
    }
    SettingsScreen.TITLE = "Settings";

    const session = await mountHeader({ title: "My Application" });
    session.app.pushScreen(<SettingsScreen />, { title: "Overridden" });
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("Overridden");
    session.unmount();
  });

  it("falls back to the class name for a falsy title, as Python's `or` does", () => {
    class BlankTitleApp extends App {}

    expect(new BlankTitleApp({ title: "" }).title).toBe("BlankTitleApp");
  });

  it("takes TITLE and SUB_TITLE declared on the App subclass", () => {
    class DeclaredTitleApp extends App {
      static TITLE = "Declared";
      static SUB_TITLE = "From the class";
    }

    const app = new DeclaredTitleApp();
    expect(app.title).toBe("Declared");
    expect(app.subTitle).toBe("From the class");
  });

  it("lets a constructor option beat the App's declared TITLE", () => {
    class DeclaredTitleApp extends App {
      static TITLE = "Declared";
    }

    expect(new DeclaredTitleApp({ title: "Passed in" }).title).toBe("Passed in");
  });

  it("lets a constructor option beat the App's declared SUB_TITLE", () => {
    class DeclaredSubTitleApp extends App {
      static SUB_TITLE = "Declared";
    }

    expect(new DeclaredSubTitleApp({ subTitle: "Passed in" }).subTitle).toBe("Passed in");
  });

  it("keeps an explicitly empty subTitle rather than falling back to SUB_TITLE", () => {
    // This is the asymmetry with `title`, which uses `||` and would fall
    // through here. `subTitle` has no third fallback, so an explicit `""` is a
    // decision to show none — and it is the only thing stopping someone from
    // "harmonizing" the two lines.
    class DeclaredSubTitleApp extends App {
      static SUB_TITLE = "Declared";
    }

    expect(new DeclaredSubTitleApp({ subTitle: "" }).subTitle).toBe("");
  });

});

describe("Header reactive updates", () => {
  it("repaints immediately when the screen title changes", async () => {
    const session = await mountHeader({ title: "My Application" });
    session.app.screenTitle = "First";
    await session.app.whenIdle();
    expect(headerRow(session)).toContain("First");

    session.app.screenTitle = "Second";
    await session.app.whenIdle();
    expect(headerRow(session)).toContain("Second");
    expect(headerRow(session)).not.toContain("First");
    session.unmount();
  });

  it("repaints immediately when the screen sub-title changes", async () => {
    const session = await mountHeader({ title: "My Application" });
    session.app.screenSubTitle = "Saving";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("My Application — Saving");
    session.unmount();
  });

  it("repaints immediately when the app title changes", async () => {
    const session = await mountHeader({ title: "My Application" });
    session.app.title = "Renamed";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("Renamed");
    session.unmount();
  });

  it("ignores an app title change while the screen defines its own", async () => {
    const session = await mountHeader({ title: "My Application" });
    session.app.screenTitle = "Settings";
    await session.app.whenIdle();

    session.app.title = "Renamed";
    await session.app.whenIdle();

    expect(headerRow(session)).toContain("Settings");
    expect(headerRow(session)).not.toContain("Renamed");
    session.unmount();
  });
});
