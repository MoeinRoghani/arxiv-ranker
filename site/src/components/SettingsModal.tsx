import { useState, useEffect } from 'react';
import { getPat, savePat, getRepo } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function SettingsModal({ open, onClose, onSave }: Props) {
  const [pat, setPat] = useState('');
  const repo = getRepo();

  useEffect(() => {
    if (open) setPat(getPat());
  }, [open]);

  if (!open) return null;

  function handleSave() {
    savePat(pat.trim());
    onSave();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>Settings</h2>

        <label>GitHub Personal Access Token</label>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxx"
        />
        <p className="modal-hint">
          Required to trigger workflows. Create at GitHub &rarr; Settings &rarr;
          Developer settings &rarr; Fine-grained personal access tokens.
          Select this repo only, grant <code>Actions: Read and write</code>.
          Stored locally in your browser — never sent anywhere except GitHub API.
        </p>

        {repo && (
          <>
            <label>Repository</label>
            <p className="modal-repo">{repo}</p>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
