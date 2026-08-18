import React, { useState, useEffect } from 'react';
import { UnitOfMeasureData } from '../../../../shared/types/ipc';

export default function UnitManager() {
  const [units, setUnits] = useState<UnitOfMeasureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [decimalAllowed, setDecimalAllowed] = useState(false);
  const [decimalPlaces, setDecimalPlaces] = useState('3');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const loadUnits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.listUnits(false);
      if (res.success) {
        setUnits(res.data || []);
      } else {
        setError(res.error || 'Failed to load units.');
      }
    } catch {
      setError('Communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!shortName.trim()) errs.shortName = 'Short name is required.';
    if (decimalAllowed) {
      const d = Number(decimalPlaces);
      if (isNaN(d) || d < 0 || d > 6) {
        errs.decimalPlaces = 'Must be between 0 and 6.';
      }
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const sv = (window as any).smartVyapar;
      const input = {
        name: name.trim(),
        shortName: shortName.trim(),
        decimalAllowed,
        decimalPlaces: decimalAllowed ? Number(decimalPlaces) : 0,
      };

      let res;
      if (editingId) {
        res = await sv.updateUnit(editingId, input);
      } else {
        res = await sv.createUnit(input);
      }

      if (res.success) {
        setName('');
        setShortName('');
        setDecimalAllowed(false);
        setDecimalPlaces('3');
        setEditingId(null);
        setFormErrors({});
        loadUnits();
      } else {
        setFormErrors({ _form: res.error || 'Operation failed.' });
      }
    } catch (err: any) {
      setFormErrors({ _form: err.message || 'Error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (u: UnitOfMeasureData) => {
    setEditingId(u.id);
    setName(u.name);
    setShortName(u.shortName);
    setDecimalAllowed(u.decimalAllowed);
    setDecimalPlaces(String(u.decimalPlaces));
    setFormErrors({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setShortName('');
    setDecimalAllowed(false);
    setDecimalPlaces('3');
    setFormErrors({});
  };

  const toggleActive = async (u: UnitOfMeasureData) => {
    try {
      setError(null);
      const res = await (window as any).smartVyapar.updateUnit(u.id, { isActive: !u.isActive });
      if (res.success) {
        loadUnits();
      } else {
        setError(res.error || 'Failed to change status.');
      }
    } catch {
      setError('Communication error.');
    }
  };

  return (
    <div className="dashboard-grid">
      {/* Form Surface */}
      <div className="card-surface">
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          {editingId ? 'Edit Unit of Measure' : 'Create Unit of Measure'}
        </h4>
        {formErrors._form && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{formErrors._form}</div>}
        <form onSubmit={handleSubmit} className="form-layout" noValidate>
          <div className="form-group">
            <label htmlFor="u-name">Unit Name *</label>
            <input
              id="u-name"
              type="text"
              className={`form-input ${formErrors.name ? 'form-input-error' : ''}`}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Kilogram"
              disabled={submitting}
            />
            {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="u-short">Short Name (Symbol) *</label>
            <input
              id="u-short"
              type="text"
              className={`form-input ${formErrors.shortName ? 'form-input-error' : ''}`}
              value={shortName}
              onChange={e => setShortName(e.target.value)}
              placeholder="e.g. KG"
              disabled={submitting}
            />
            {formErrors.shortName && <span className="form-error-msg">{formErrors.shortName}</span>}
          </div>

          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={decimalAllowed}
                onChange={e => setDecimalAllowed(e.target.checked)}
                disabled={submitting}
              />
              Allow Fractional/Decimal Quantities
            </label>
          </div>

          {decimalAllowed && (
            <div className="form-group">
              <label htmlFor="u-decimals">Decimal Places</label>
              <input
                id="u-decimals"
                type="number"
                min="0"
                max="6"
                className={`form-input ${formErrors.decimalPlaces ? 'form-input-error' : ''}`}
                value={decimalPlaces}
                onChange={e => setDecimalPlaces(e.target.value)}
                disabled={submitting}
              />
              {formErrors.decimalPlaces && <span className="form-error-msg">{formErrors.decimalPlaces}</span>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
            {editingId && (
              <button type="button" className="app-btn btn-secondary" onClick={handleCancel} disabled={submitting} style={{ flex: 1 }}>
                Cancel
              </button>
            )}
            <button type="submit" className="app-btn btn-primary" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Saving...' : editingId ? 'Update Unit' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>

      {/* List Surface */}
      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          Registered Units
        </h4>
        {error && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="data-table-wrapper" style={{ flex: 1 }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner-sm" />
              <span>Loading...</span>
            </div>
          ) : units.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📏</span>
              <p className="empty-state-title">No units registered</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Symbol</th>
                  <th>Decimals</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.6 }}>
                    <td><strong style={{ color: 'white' }}>{u.name}</strong></td>
                    <td className="text-mono">{u.shortName}</td>
                    <td>{u.decimalAllowed ? `Yes (${u.decimalPlaces} places)` : 'No'}</td>
                    <td>
                      <span className={`status-badge ${u.isActive ? 'status-active' : 'status-inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => handleEdit(u)} title="Edit">✏️</button>
                        <button className={`btn-icon ${u.isActive ? 'btn-danger' : ''}`} onClick={() => toggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive ? '⏸' : '▶'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
