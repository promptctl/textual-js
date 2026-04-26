from textual.app import App, ComposeResult
from textual.widgets import Static
from rich.text import Text


class StyledContentApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static(Text.from_markup("[#ff5555]Bright[/] [#b3b3b3]Gray[/] [#112233 on rgb(10,20,30)]RGB[/]"))
        yield Static(Text.from_markup("[bold][italic][underline][reverse]Attrs[/][/][/][/]"))


app = StyledContentApp

interactions = []
