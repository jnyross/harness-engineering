# Testing pi Interactive Mode with tmux

To test pi's TUI in a controlled terminal environment:

## Setup tmux Session

```bash
# Create tmux session with specific dimensions
tmux new-session -d -s pi-test -x 80 -y 24
```

## Run pi from Source

```bash
# Start pi from repo root
tmux send-keys -t pi-test "cd /path/to/repo && ./pi-test.sh" Enter
```

## Interact with pi

```bash
# Wait for startup, then capture output
sleep 3 && tmux capture-pane -t pi-test -p

# Send input
tmux send-keys -t pi-test "your prompt here" Enter

# Send special keys
tmux send-keys -t pi-test Escape
tmux send-keys -t pi-test C-o  # ctrl+o

# Cleanup
tmux kill-session -t pi-test
```

## Useful tmux Commands

| Command | Description |
|---------|-------------|
| `tmux list-sessions` | List all sessions |
| `tmux attach -t pi-test` | Attach to session |
| `tmux send-keys -t pi-test C-c` | Send ctrl+c to interrupt |
