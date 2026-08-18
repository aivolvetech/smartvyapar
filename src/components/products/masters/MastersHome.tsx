import { useState } from 'react';
import UnitManager from './UnitManager';
import CategoryManager from './CategoryManager';
import BrandManager from './BrandManager';
import TaxRateManager from './TaxRateManager';

type MasterTab = 'units' | 'categories' | 'brands' | 'taxRates';

interface Props {
  initialTab?: MasterTab;
}

export default function MastersHome({ initialTab = 'units' }: Props) {
  const [activeTab, setActiveTab] = useState<MasterTab>(initialTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Sub-navigation tabs for master data management */}
      <div className="sub-nav" style={{ marginBottom: 'var(--space-md)' }}>
        <button
          className={`sub-nav-btn ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
        >
          📏 Units of Measure
        </button>
        <button
          className={`sub-nav-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          📁 Categories
        </button>
        <button
          className={`sub-nav-btn ${activeTab === 'brands' ? 'active' : ''}`}
          onClick={() => setActiveTab('brands')}
        >
          🏷️ Brands
        </button>
        <button
          className={`sub-nav-btn ${activeTab === 'taxRates' ? 'active' : ''}`}
          onClick={() => setActiveTab('taxRates')}
        >
          💰 Tax Rates (GST)
        </button>
      </div>

      {/* Render selected manager view */}
      <div>
        {activeTab === 'units' && <UnitManager />}
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'brands' && <BrandManager />}
        {activeTab === 'taxRates' && <TaxRateManager />}
      </div>
    </div>
  );
}
