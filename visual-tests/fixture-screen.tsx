import React, { type PropsWithChildren } from "react";
import { Box } from "ink";

// [LAW:one-source-of-truth] (partial — known limitation) The visual screen
// background hex must agree across THREE language domains that have no
// shared build step:
//   1. This TS constant   → consumed by Ink in FixtureScreen below.
//   2. xterm -bg / -cr in visual-tests/render-fixture-xvfb.sh.
//   3. `Screen { background: #121212 }` (or `$background`) in every Python
//      fixture's CSS string.
// A fully unified source would require a Python module emitting the CSS
// string + a generated bash include + this TS export. Until that exists,
// changing this hex requires synchronous edits in all three places, plus
// regenerating every committed baseline.
export const VISUAL_SCREEN_BACKGROUND = "#121212";
export const VISUAL_SCREEN_FOREGROUND = "#e0e0e0";
export const VISUAL_SCREEN_WIDTH = 80;
export const VISUAL_SCREEN_HEIGHT = 24;

export function FixtureScreen({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <Box
      width={VISUAL_SCREEN_WIDTH}
      height={VISUAL_SCREEN_HEIGHT}
      flexDirection="column"
      backgroundColor={VISUAL_SCREEN_BACKGROUND}
    >
      {children}
    </Box>
  );
}
