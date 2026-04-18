import React from "react";
import { Box, Text } from "ink";

import { WidgetScope, useStyles, useWidget } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    TooltipTarget {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

function TooltipTarget(): React.JSX.Element {
  const widget = useWidget({
    id: "target",
    typeName: "TooltipTarget",
    tooltip: "[#ff5555]Tip[/]",
  });
  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <Box width={10} height={1} {...styles.box}>
        <Text {...styles.text} color={VISUAL_SCREEN_FOREGROUND}>hover me</Text>
      </Box>
    </WidgetScope>
  );
}

export default function TooltipMarkupFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <TooltipTarget />
    </FixtureScreen>
  );
}

export async function capture(session: { framework: { setShowTooltips: (enabled: boolean) => void; setTooltipDelay: (delay: number) => void }; pilot: { hover: (target: string) => Promise<boolean>; pause: (delay?: number) => Promise<void> } }): Promise<void> {
  session.framework.setShowTooltips(true);
  session.framework.setTooltipDelay(10);
  await session.pilot.hover("#target");
  await session.pilot.pause(20);
}
