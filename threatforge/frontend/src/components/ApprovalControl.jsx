import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../api/client.js';

const STATES = {
  approved: { label: 'Approved', className: 'is-good' },
  rejected: { label: 'Rejected', className: 'is-bad' },
  pending: { label: 'Awaiting approval', className: 'is-working' },
};

export default function ApprovalControl({ stageKey, recordKey, itemKey, value, onReload, onDecision }) {
  const [busy, setBusy] = useState(false);
  if (!itemKey) return null;
  const current = value === 'approved' || value === 'rejected' ? value : 'pending';

  const decide = async (next) => {
    if (busy || next === current) return;
    setBusy(true);
    try {
      await api.updateLifecycleRecord(stageKey, recordKey, itemKey, { authorization_status: next });
      onDecision?.(next);
      onReload?.();
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
    </div>
  );
}
