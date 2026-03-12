import { useEffect } from 'react';

interface Props {
  message: string;
  isError?: boolean;
  onDismiss: () => void;
}

export default function Toast({ message, isError, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`toast ${isError ? 'toast-error' : ''}`}>
      {message}
    </div>
  );
}
