import React, { type PropsWithChildren } from "react";
import { Box } from "ink";

// Matches the `Screen { background: #121212 }` CSS that Python fixtures
// declare. In truecolor terminal mode, Textual paints that color onto every
// Screen cell; JS fixtures paint the same color via FixtureScreen so the
// two pipelines render identical backgrounds.
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
