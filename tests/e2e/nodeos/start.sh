#!/bin/bash
set -euo pipefail

DATA_DIR="/data/nodeos"
CONFIG_DIR="/config"

# First-run: initialize with genesis
if [ ! -f "${DATA_DIR}/blocks/blocks.log" ]; then
    echo "==> First run detected, initializing chain from genesis..."
    exec nodeos \
        --data-dir "${DATA_DIR}" \
        --config-dir "${CONFIG_DIR}" \
        --genesis-json "${CONFIG_DIR}/genesis.json" \
        --delete-all-blocks \
        "$@"
else
    # Always replay-blockchain on resume to recover from any unclean shutdown
    # (e.g. docker compose up -d --build kills the old container mid-run).
    # Replay is fast for a small test chain.
    echo "==> Resuming from existing chain data (with replay)..."
    exec nodeos \
        --data-dir "${DATA_DIR}" \
        --config-dir "${CONFIG_DIR}" \
        --replay-blockchain \
        "$@"
fi
