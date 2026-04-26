"""Fixture: DataTable with 3 columns and 4 rows (no header)."""

from textual.app import App, ComposeResult
from textual.widgets import DataTable


class DataTableBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield DataTable(show_header=False)

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns("A", "B", "C")
        table.add_rows(
            [
                ("1", "alpha", "x"),
                ("2", "beta", "y"),
                ("3", "gamma", "z"),
                ("4", "delta", "w"),
            ]
        )


app = DataTableBasicApp

interactions = []
