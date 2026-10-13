import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../api/client.js';

const STATES = {
  approved: { label: 'Approved', className: 'is-good' },
  rejected: { label: 'Rejected', className: 'is-bad' },
  pending: { label: 'Awaiting approval', className: 'is-working' },
};

const normalizeState = (value) => (value === 'approved' || value === 'rejected' ? value : 'pending');

export default function ApprovalControl({ stageKey, recordKey, itemKey, value, onDecision }) {
  const [current, setCurrent] = useState(normalizeState(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrent(normalizeState(value));
  }, [value]);

  if (!itemKey) return null;

  const decide = async (next) => {
    if (busy || next === current) return;
    const previous = current;
    setCurrent(next);
    onDecision?.(next);
    setBusy(true);
    setError('');
    try {
      await api.updateLifecycleRecord(stageKey, recordKey, itemKey, { authorization_status: next });
    } catch (err) {
      setCurrent(previous);
      onDecision?.(previous);
      setError(err.message || 'Could not update approval.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`approval-control ${STATES[current].className}`}>
      <span className="approval-control__state">{STATES[current].label}</span>
      <div className="approval-control__actions">
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => decide('approved')}>
          <Check size={13} aria-hidden="true" />
          Approve
        </button>
        <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => decide('rejected')}>
          <X size={13} aria-hidden="true" />
          Reject
        </button>
      </div>
      {error && <small className="approval-control__error">{error}</small>}
    </div>
  );
}
