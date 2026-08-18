import React, { useState, useEffect } from 'react';
import { ProductCategoryData } from '../../../../shared/types/ipc';

export default function CategoryManager() {
  const [categories, setCats] = useState<ProductCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentId] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).smartVyapar.listCategories(false);
      if (res.success) {
        setCats(res.data || []);
      } else {
        setError(res.error || 'Failed to load categories.');
      }
    } catch {
      setError('Communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Category name is required.';
    const order = Number(displayOrder);
    if (isNaN(order) || order < 0) errs.displayOrder = 'Must be non-negative.';
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
        parentCategoryId: parentCategoryId || undefined,
        displayOrder: Number(displayOrder) || 0,
      };

      let res;
      if (editingId) {
        res = await sv.updateCategory(editingId, input);
      } else {
        res = await sv.createCategory(input);
      }

      if (res.success) {
        setName('');
        setDescription('');
        setParentId('');
        setDisplayOrder('0');
        setEditingId(null);
        setFormErrors({});
        loadCategories();
      } else {
        setFormErrors({ _form: res.error || 'Operation failed.' });
      }
    } catch (err: any) {
      setFormErrors({ _form: err.message || 'Error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (c: ProductCategoryData) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description || '');
    setParentId(c.parentCategoryId || '');
    setDisplayOrder(String(c.displayOrder));
    setFormErrors({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setParentId('');
    setDisplayOrder('0');
    setFormErrors({});
  };

  const toggleActive = async (c: ProductCategoryData) => {
    try {
      setError(null);
      const res = await (window as any).smartVyapar.updateCategory(c.id, { isActive: !c.isActive });
      if (res.success) {
        loadCategories();
      } else {
        setError(res.error || 'Failed to change status.');
      }
    } catch {
      setError('Communication error.');
    }
  };

  // Helper to map parent names
  const getParentName = (parentId: string | null) => {
    if (!parentId) return '—';
    const parent = categories.find(c => c.id === parentId);
    return parent ? parent.name : '—';
  };

  // Safe category list for parenting selection (excludes self and circular descendants)
  // Depth maximum 3 levels: only categories that are at depth 1 or 2 are candidates for parent
  const parentCandidates = categories.filter(c => {
    if (!c.isActive) return false;
    if (editingId) {
      if (c.id === editingId) return false;
      if (c.parentCategoryId === editingId) return false;
    }
    return true; // Simple check, deeper checks done at service layer
  });

  return (
    <div className="dashboard-grid">
      {/* Form Surface */}
      <div className="card-surface">
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          {editingId ? 'Edit Product Category' : 'Create Product Category'}
        </h4>
        {formErrors._form && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{formErrors._form}</div>}
        <form onSubmit={handleSubmit} className="form-layout" noValidate>
          <div className="form-group">
            <label htmlFor="cat-name">Category Name *</label>
            <input
              id="cat-name"
              type="text"
              className={`form-input ${formErrors.name ? 'form-input-error' : ''}`}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grocery"
              disabled={submitting}
            />
            {formErrors.name && <span className="form-error-msg">{formErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="cat-desc">Description</label>
            <textarea
              id="cat-desc"
              className="form-input"
              style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional category description"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat-parent">Parent Category (Up to 3 levels)</label>
            <select
              id="cat-parent"
              className="form-select"
              value={parentCategoryId}
              onChange={e => setParentId(e.target.value)}
              disabled={submitting}
            >
              <option value="">— None (Root Category) —</option>
              {parentCandidates.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parentCategoryId ? '↳ ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cat-order">Display Order</label>
            <input
              id="cat-order"
              type="number"
              min="0"
              className={`form-input ${formErrors.displayOrder ? 'form-input-error' : ''}`}
              value={displayOrder}
              onChange={e => setDisplayOrder(e.target.value)}
              placeholder="0"
              disabled={submitting}
            />
            {formErrors.displayOrder && <span className="form-error-msg">{formErrors.displayOrder}</span>}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
            {editingId && (
              <button type="button" className="app-btn btn-secondary" onClick={handleCancel} disabled={submitting} style={{ flex: 1 }}>
                Cancel
              </button>
            )}
            <button type="submit" className="app-btn btn-primary" disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>

      {/* List Surface */}
      <div className="card-surface" style={{ display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'white', fontSize: '1.1rem' }}>
          Categories list
        </h4>
        {error && <div className="inline-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="data-table-wrapper" style={{ flex: 1 }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner-sm" />
              <span>Loading...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📁</span>
              <p className="empty-state-title">No categories registered</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parent Category</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.6 }}>
                    <td>
                      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>
                        {c.parentCategoryId ? '↳ ' : '▪ '}
                      </span>
                      <strong style={{ color: 'white' }}>{c.name}</strong>
                    </td>
                    <td className="text-muted">{getParentName(c.parentCategoryId)}</td>
                    <td>{c.displayOrder}</td>
                    <td>
                      <span className={`status-badge ${c.isActive ? 'status-active' : 'status-inactive'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => handleEdit(c)} title="Edit">✏️</button>
                        <button className={`btn-icon ${c.isActive ? 'btn-danger' : ''}`} onClick={() => toggleActive(c)} title={c.isActive ? 'Deactivate' : 'Activate'}>
                          {c.isActive ? '⏸' : '▶'}
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
