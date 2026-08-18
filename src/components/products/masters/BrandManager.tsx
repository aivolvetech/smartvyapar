import React, { useState, useEffect } from 'react';
import { BrandData } from '../../../../shared/types/ipc';

export default function BrandManager() {
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const loadBrands = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.listBrands(false);
      if (res.success) {
        setBrands(res.data || []);
      } else {
        setError(res.error || 'Failed to load brands.');
      }
    } catch {
      setError('Communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Brand name is required.';
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
        description: description.trim() || undefined,
      };

      let res;
      if (editingId) {
        res = await sv.updateBrand(editingId, input);
      } else {
        res = await sv.createBrand(input);
      }

      if (res.success) {
        setName('');
        setDescription('');
        setEditingId(null);
        setFormErrors({});
        loadBrands();
      } else {
        setFormErrors({ _form: res.error || 'Operation failed.' });
      }
    } catch (err: any) {
      setFormErrors({ _form: err.message || 'Error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (b: BrandData) => {
    setEditingId(b.id);
    setName(b.name);
    setDescription(b.description || '');
    setFormErrors({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setFormErrors({});
  };

  const toggleActive = async (b: BrandData) => {
    try {
      setError(null);
      const res = await (window as any).smartVyapar.updateBrand(b.id, { isActive: !b.isActive });
      if (res.success) {
        loadBrands();
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
          {editingId ? 'Edit Brand' : 'Create Brand'}
        </h4>
        {formErrors._form && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{formErrors._form}</div>}
        <form onSubmit={handleSubmit} className="form-layout" noValidate>
          <div className="form-group">
            <label htmlFor="b-name">Brand Name *</label>
            <input
              id="b-name"
              type="text"
              className={`form-input ${formErrors.name ? 'form-input-error' : ''}`}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Tata"
              disabled={submitting}
            />
            {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="b-desc">Description</label>
            <textarea
              id="b-desc"
              className="form-input"
              style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional brand description"
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
            {editingId && (
              <button type="button" className="app-btn btn-secondary" onClick={handleCancel} disabled={submitting} style={{ flex: 1 }}>
                Cancel
              </button>
            )}
            <button type="submit" className="app-btn btn-primary" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Saving...' : editingId ? 'Update Brand' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>

      {/* List Surface */}
      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          Registered Brands
        </h4>
        {error && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="data-table-wrapper" style={{ flex: 1 }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner-sm" />
              <span>Loading...</span>
            </div>
          ) : brands.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🏷️</span>
              <p className="empty-state-title">No brands registered</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map(b => (
                  <tr key={b.id} style={{ opacity: b.isActive ? 1 : 0.6 }}>
                    <td><strong style={{ color: 'white' }}>{b.name}</strong></td>
                    <td className="text-muted">{b.description || '—'}</td>
                    <td>
                      <span className={`status-badge ${b.isActive ? 'status-active' : 'status-inactive'}`}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => handleEdit(b)} title="Edit">✏️</button>
                        <button className={`btn-icon ${b.isActive ? 'btn-danger' : ''}`} onClick={() => toggleActive(b)} title={b.isActive ? 'Deactivate' : 'Activate'}>
                          {b.isActive ? '⏸' : '▶'}
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
