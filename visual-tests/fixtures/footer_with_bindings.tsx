import React from "react";
import { Footer, Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  bindings: [
    { key: "q", action: "quit", description: "Quit" },
    { key: "s", action: "save", description: "Save" },
    { key: "ctrl+r", action: "reload", description: "Reload" },
  ],
  actions: {
    save: () => {},
    reload: () => {},
  },
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function FooterWithBindingsFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="Body content" />
      <Footer />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
