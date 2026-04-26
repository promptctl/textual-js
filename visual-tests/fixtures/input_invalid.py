"""Fixture: Input with a Number validator failing against the current value."""

from textual.app import App, ComposeResult
from textual.validation import Number
from textual.widgets import Input


class InputInvalidApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(
            value="abc",
            validators=[Number()],
            validate_on=("changed",),
        )

    def on_mount(self) -> None:
        # [LAW:dataflow-not-control-flow] The invalid state is part of the
        # fixture's initial data, not a post-render interaction — force the
        # Number validator to evaluate "abc" at mount time.
        input_widget = self.query_one(Input)
        input_widget.validate(input_widget.value)


app = InputInvalidApp


interactions = []
