from textual.app import App, ComposeResult
from textual.widgets import Static
from rich.text import Text


class TooltipMarkupApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        target = Static("hover me", id="target")
        target.tooltip = Text.from_markup("[#ff5555]Tip[/]")
        yield target


async def capture(pilot) -> None:
    await pilot.hover("#target")
    await pilot.pause(0.05)


app = TooltipMarkupApp
