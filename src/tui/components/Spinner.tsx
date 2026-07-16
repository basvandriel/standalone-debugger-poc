// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  color: string;
}

// Frame-cycling braille spinner for the `initializing` phase only. The
// interval is always cleared on unmount -- an uncleared setTimeout/interval
// is exactly the class of bug that made session shutdown hang for up to 20s
// earlier in this project, so this one must never outlive the component.
export function Spinner({ color }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);

  return <Text color={color}>{FRAMES[frame]}</Text>;
}
