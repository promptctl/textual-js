"""Fixture: DataTable with cursor_type='row' moved down one via pilot."""

from textual.app import App, ComposeResult
from textual.widgets import DataTable


class DataTableCursorRowApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield DataTable(cursor_type="row", show_header=True)

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns("Name", "Role")
        table.add_rows(
            [
                ("Alice", "Engineer"),
                ("Bob", "Designer"),
                ("Carol", "PM"),
            ]
        )
        table.focus()


app = DataTableCursorRowApp

interactions = [
    {"type": "key", "keys": "Down"},
    {"type": "wait", "ms": 50},
]
