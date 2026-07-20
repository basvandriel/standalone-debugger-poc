Output demo/demo.gif

Set FontSize 16
Set Width 1600
Set Height 650
Set Theme "TokyoNight"
Set Framerate 24
Set TypingSpeed 50ms

# Clean up prompt and cd into the project
Hide
Type "export PS1='› '"
Enter
Type "cd /Users/bas/standalone-debugger-poc"
Enter
Show

# Launch the TUI debugger against the Rust loop-demo fixture
Type "npm run demo"
Enter

# Wait for lldb-dap handshake to complete (READY state)
Sleep 4s

# Source panel is open at main.rs, cursor at line 1.
# Navigate down to line 7: total += doubled as i64  (j × 6)
Type "jjjjjj"
Sleep 700ms

# Set a breakpoint — a ● indicator appears in the gutter
Type "b"
Sleep 1200ms

# Run — status badge transitions READY → RUNNING → PAUSED
Type "c"
Sleep 3s

# Program is paused at the breakpoint.
# Tab to the Stack panel
Tab
Sleep 500ms

# Tab to the Variables panel
Tab
Sleep 1500ms

# Expand the LOCALS scope to reveal variable values
Type "l"
Sleep 800ms

# Browse down through the locals (i, doubled, total)
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 600ms

# Tab back to source (variables → watch → console → source)
Tab
Sleep 200ms
Tab
Sleep 200ms
Tab
Sleep 500ms

# Step over — execution advances one line, variable values update
Type "n"
Sleep 2200ms

# Step again — see total accumulate
Type "n"
Sleep 2200ms

# Clear the breakpoint and run to completion
Type "b"
Sleep 500ms
Type "c"
Sleep 3s

# Quit
Type "q"
