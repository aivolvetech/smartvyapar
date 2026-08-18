import { useState } from 'react';
import CustomerList from './CustomerList';
import CustomerForm from './CustomerForm';
import CustomerView from './CustomerView';

type CustomerViewType = 'LIST' | 'VIEW' | 'CREATE' | 'EDIT';

export default function CustomerModule() {
  const [view, setView] = useState<CustomerViewType>('LIST');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleEditClick = async (item: any) => {
    setLoading(true);
    try {
      const res = await (window as any).smartVyapar.getCustomerById(item.id);
      if (res.success) {
        setEditingCustomer(res.data.customer);
        setView('EDIT');
      } else {
        alert(res.error || 'Failed to fetch customer details for editing.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    setView('LIST');
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return <div className="card-surface">Loading customer workspace...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {view === 'LIST' && (
        <CustomerList
          onView={id => {
            setSelectedCustomerId(id);
            setView('VIEW');
          }}
          onEdit={handleEditClick}
          onCreate={() => setView('CREATE')}
          refreshTrigger={refreshTrigger}
        />
      )}

      {view === 'VIEW' && (
        <CustomerView
          customerId={selectedCustomerId}
          onBack={() => setView('LIST')}
          onEdit={() => handleEditClick({ id: selectedCustomerId })}
        />
      )}

      {view === 'CREATE' && (
        <CustomerForm
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}

      {view === 'EDIT' && (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
}
