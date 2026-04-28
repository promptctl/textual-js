import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import {
  WidgetHost,
  runTest,
} from "../src/index.js";

describe("Stage 4 app pointer shape", () => {
  it("updates pointerShape from the hovered widget's pointer style", async () => {
    const session = await runTest(
      <>
        <WidgetHost typeName="Label" id="default-target">
          <Text>default</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="pointer-target">
          <Text>pointer</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="text-target">
          <Text>text</Text>
        </WidgetHost>
      </>,
      {
        appProps: {
          stylesheet: `
            #pointer-target {
              pointer: pointer;
            }

            #text-target {
              pointer: text;
            }
          `,
        },
      },
    );

    expect(await session.pilot.hover("#default-target")).toBe(true);
    expect(session.app.pointerShape).toBe("default");

    expect(await session.pilot.hover("#pointer-target")).toBe(true);
    expect(session.app.pointerShape).toBe("pointer");

    expect(await session.pilot.hover("#text-target")).toBe(true);
    expect(session.app.pointerShape).toBe("text");

    session.unmount();
  });
});
