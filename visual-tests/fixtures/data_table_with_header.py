"""Fixture: DataTable with show_header=True and labeled columns."""

from textual.app import App, ComposeResult
from textual.widgets import DataTable


class DataTableWithHeaderApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield DataTable(show_header=True)

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns("Name", "Age", "City")
        table.add_rows(
            [
                ("Alice", "30", "NYC"),
                ("Bob", "42", "LA"),
                ("Carol", "27", "SEA"),
            ]
        )


app = DataTableWithHeaderApp

interactions = []
