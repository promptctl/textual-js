"""Fixture: DataTable where rows have labels shown to the left."""

from textual.app import App, ComposeResult
from textual.widgets import DataTable


class DataTableWithRowLabelsApp(App):
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
        table.add_columns("Metric", "Value")
        table.add_row("cpu", "42%", label="row-a")
        table.add_row("mem", "71%", label="row-b")
        table.add_row("net", "12 MB/s", label="row-c")


app = DataTableWithRowLabelsApp

interactions = []
