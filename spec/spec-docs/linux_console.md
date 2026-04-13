# Linux Console

## Overview

The Linux console (the text-mode interface outside a desktop environment) has reduced graphical capabilities compared to terminal emulators running within a desktop environment.

## Graphical Limitations

The Linux console provides less graphical capability than desktop terminal emulators. Applications that render correctly in a desktop terminal may not look correct or visually appealing when run directly on the Linux console.

## Font Support

When applications do not render well under the default Linux console configuration, the `font-for-textual` project (https://github.com/jsatchell/font-for-textual) provides a possible solution by supplying a font designed for improved Textual rendering on the Linux console.

## Platform Context

All Linux distributions include a terminal emulator capable of running Textual applications when a desktop environment is present. The Linux console's limited support is specific to running outside a desktop environment (e.g., a bare TTY).
