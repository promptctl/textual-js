FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    fonts-dejavu-core \
    imagemagick \
    x11-utils \
    xdotool \
    xterm \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work
