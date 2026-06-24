import { useState, type FormEvent } from 'react';
import { createJob } from '@/lib/api';
import {
  EMPTY_CREATE_JOB_FORM,
  JOB_CATEGORIES,
  formValuesToPayload,
  validateCreateJobForm,
  type CreateJobFormValues,
} from '@/lib/validation/jobForm';
import type { Job } from '@/lib/api';

interface CreateJobFormProps {
  onCreated: (job: Job) => void;
  onCancel?: () => void;
}

export function CreateJobForm({ onCreated, onCancel }: CreateJobFormProps) {
  const [values, setValues] = useState<CreateJobFormValues>(EMPTY_CREATE_JOB_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof CreateJobFormValues>(key: K, value: CreateJobFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errors = validateCreateJobForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = formValuesToPayload(values);
      const res = await createJob(payload);
      if (!res.success || !res.job) {
        throw new Error(res.error || 'Failed to create job');
      }
      onCreated(res.job);
      setValues(EMPTY_CREATE_JOB_FORM);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="create-job-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="job-title">Title</label>
        <input
          id="job-title"
          className="input full"
          value={values.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Smart Contract Audit (5–100 chars)"
          maxLength={100}
        />
        {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-description">Description</label>
        <textarea
          id="job-description"
          className="input full textarea"
          rows={4}
          value={values.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="At least 20 characters…"
        />
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="job-category">Category</label>
          <select
            id="job-category"
            className="input full"
            value={values.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {JOB_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </div>

        <div className="field">
          <label htmlFor="job-budget">Budget (USDC)</label>
          <input
            id="job-budget"
            className="input full"
            type="number"
            min={1}
            step={1}
            value={values.contractValue}
            onChange={(e) => updateField('contractValue', e.target.value)}
          />
          {fieldErrors.contractValue && (
            <span className="field-error">{fieldErrors.contractValue}</span>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="job-skills">Skills (comma-separated)</label>
        <input
          id="job-skills"
          className="input full"
          value={values.skills}
          onChange={(e) => updateField('skills', e.target.value)}
          placeholder="Solidity, Security, Hardhat"
        />
      </div>

      <div className="field">
        <label htmlFor="job-duration">Duration (days)</label>
        <input
          id="job-duration"
          className="input full"
          type="number"
          min={1}
          step={1}
          value={values.durationDays}
          onChange={(e) => updateField('durationDays', e.target.value)}
        />
        <span className="muted phase-note">Minimum 1 day (3600 seconds on-chain).</span>
        {fieldErrors.durationDays && <span className="field-error">{fieldErrors.durationDays}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-deliverables">Deliverables</label>
        <textarea
          id="job-deliverables"
          className="input full textarea"
          rows={3}
          value={values.deliverables}
          onChange={(e) => updateField('deliverables', e.target.value)}
        />
        {fieldErrors.deliverables && <span className="field-error">{fieldErrors.deliverables}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-acceptance">Acceptance criteria</label>
        <textarea
          id="job-acceptance"
          className="input full textarea"
          rows={3}
          value={values.acceptanceCriteria}
          onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
        />
        {fieldErrors.acceptanceCriteria && (
          <span className="field-error">{fieldErrors.acceptanceCriteria}</span>
        )}
      </div>

      {submitError && <p className="error">{submitError}</p>}

      <div className="form-actions">
        {onCancel && (
          <button className="btn ghost" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create job'}
        </button>
      </div>
      <p className="muted phase-note">
        Metadata is uploaded to IPFS by the backend; on-chain <code>createJob</code> runs server-side.
      </p>
    </form>
  );
}
