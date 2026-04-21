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


async def capture(pilot) -> None:
    # Trigger validation by emitting a Changed message at the current value.
    input_widget = pilot.app.query_one(Input)
    input_widget.validate(input_widget.value)
    await pilot.pause(0.05)


app = InputInvalidApp
