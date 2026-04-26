from textual.app import App, ComposeResult
from textual.widgets import Button
from rich.text import Text


class ButtonsWithMarkupApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Button {
        border: none;
        height: 1;
        min-width: 0;
        width: auto;
        padding: 0 0;
        text-style: none;
        background: transparent;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Button(Text.from_markup("[italic #ff5555]Focused[/] Button"))
        yield Button(Text.from_markup("[italic #ff5555]Blurred[/] Button"))
        yield Button(Text.from_markup("[italic #ff5555]Disabled[/] Button"), disabled=True)


app = ButtonsWithMarkupApp

interactions = []
