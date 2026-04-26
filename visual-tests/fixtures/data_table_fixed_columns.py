"""Fixture: DataTable with fixed_columns=1 and many columns overflowing 80 cols."""

from textual.app import App, ComposeResult
from textual.widgets import DataTable


class DataTableFixedColumnsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield DataTable(show_header=True, fixed_columns=1)

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_columns(
            "ID",
            "Column-Two",
            "Column-Three",
            "Column-Four",
            "Column-Five",
            "Column-Six",
            "Column-Seven",
        )
        table.add_rows(
            [
                ("1", "aaaaaaa", "bbbbbbb", "ccccccc", "ddddddd", "eeeeeee", "fffffff"),
                ("2", "ggggggg", "hhhhhhh", "iiiiiii", "jjjjjjj", "kkkkkkk", "lllllll"),
                ("3", "mmmmmmm", "nnnnnnn", "ooooooo", "ppppppp", "qqqqqqq", "rrrrrrr"),
            ]
        )


app = DataTableFixedColumnsApp

interactions = []
