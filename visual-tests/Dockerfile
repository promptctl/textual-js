FROM debian:bookworm-slim

# System packages: terminal emulator + X virtual display + screenshot tooling
# plus language runtimes for running fixtures natively inside the container.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    gnupg \
    fonts-dejavu-core \
    imagemagick \
    python3 \
    python3-pip \
    python3-venv \
    x11-utils \
    xdotool \
    xterm \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

# Node 20 from NodeSource (Debian ships 18; textual-js deps use post-18 regex).
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# uv manages the Python environment for visual-tests/pyproject.toml
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH=/root/.local/bin:${PATH}

# tsx executes the JS runner and orchestrator helpers without a build step
RUN npm install -g tsx

# Python venv lives outside /work so bind-mounted host source cannot shadow it.
# uv auto-syncs /deps/venv on first `uv run` per pyproject.toml + uv.lock.
ENV UV_PROJECT_ENVIRONMENT=/deps/venv

# Force UTF-8 for xterm (fixes mojibake on box-drawing glyphs) and Python stdio.
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8
ENV PYTHONIOENCODING=utf-8

WORKDIR /work
