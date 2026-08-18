import { useState, useEffect } from 'react';
import { ImportType, ImportJob, ImportJobRow, ImportMapping, ImportDuplicatePolicy, ImportTransactionMode, ImportColumnDefinition } from '../../../shared/types/import';

const IMPORT_TYPES: { type: ImportType; label: string; desc: string; icon: string }[] = [
  { type: 'UNIT', label: 'Units of Measure', desc: 'Import product packaging units (e.g. PCS, KG, BOX)', icon: '📦' },
  { type: 'TAX_RATE', label: 'Tax Rates & GST Slabs', desc: 'Import active GST/IGST slabs and cess settings', icon: '💰' },
  { type: 'PRICE_BOOK', label: 'Price Books', desc: 'Import custom pricing lists (e.g. WHOLESALE, RETAIL)', icon: '📖' },
  { type: 'PRODUCT', label: 'Product Master', desc: 'Import inventory products, units, HSNs, pricing cost', icon: '🏷️' },
  { type: 'PRODUCT_BARCODE', label: 'Product Barcodes', desc: 'Import multiple custom barcodes per product', icon: '⚡' },
  { type: 'PRODUCT_PRICE', label: 'Product Prices', desc: 'Import custom price book rates and effective dates', icon: '💸' },
  { type: 'OPENING_STOCK', label: 'Opening Stock', desc: 'Post initial warehouse quantities and costs', icon: '🏭' },
  { type: 'SUPPLIER', label: 'Supplier Master', desc: 'Import business contact directories and addresses', icon: '👤' },
  { type: 'SUPPLIER_OPENING_BALANCE', label: 'Supplier Opening Balance', desc: 'Post initial payable/receivable balances', icon: '💳' }
];

export default function BulkImportModule({ preselectedType, onClearPreselect }: { preselectedType?: ImportType | null; onClearPreselect?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<ImportType | null>(null);

  useEffect(() => {
    if (preselectedType) {
      handleSelectType(preselectedType);
      if (onClearPreselect) onClearPreselect();
    }
  }, [preselectedType]);
  
  // File and token state
  const [fileToken, setFileToken] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [worksheets, setWorksheets] = useState<string[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>('');

  // Job and rows state
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<ImportColumnDefinition[]>([]);
  
  // Review rows state
  const [previewRows, setPreviewRows] = useState<ImportJobRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageSize] = useState<number>(20);

  // Policy configurations
  const [dupPolicy, setDupPolicy] = useState<ImportDuplicatePolicy>('SKIP_DUPLICATES');
  const [txMode, setTxMode] = useState<ImportTransactionMode>('VALID_ROWS_ONLY');

  // Execution states
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [history, setHistory] = useState<ImportJob[]>([]);

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (selectedType) {
      (window as any).smartVyapar.getImportColumns(selectedType).then((res: any) => {
        if (res.success) {
          setColumns(res.data);
        }
      });
    } else {
      setColumns([]);
    }
  }, [selectedType]);

  const loadHistory = async () => {
    try {
      const res = await (window as any).smartVyapar.getImportHistory({});
      if (res.success) {
        setHistory(res.data);
      }
    } catch {}
  };

  const handleSelectType = (type: ImportType) => {
    setSelectedType(type);
    setStep(2);
    setFileToken(null);
    setFileName('');
    setFileSize(0);
    setWorksheets([]);
    setMapping({});
    setErrorMsg(null);
    setInfoMsg(null);
    
    // Set safer defaults for Ledger/Opening types
    if (type === 'OPENING_STOCK' || type === 'SUPPLIER_OPENING_BALANCE' || type === 'PRODUCT_PRICE') {
      setTxMode('ATOMIC_ALL_OR_NOTHING');
    } else {
      setTxMode('VALID_ROWS_ONLY');
    }
  };

  const downloadTemplate = async () => {
    if (!selectedType) return;
    try {
      const res = await (window as any).smartVyapar.getImportTemplates(selectedType);
      if (res.success) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `template_${selectedType.toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to download template: ${err.message}`);
    }
  };

  const handleSelectFile = async () => {
    setErrorMsg(null);
    try {
      const res = await (window as any).smartVyapar.selectImportFile();
      if (res.success && res.data) {
        setFileToken(res.data.token);
        setFileName(res.data.fileName);
        setFileSize(res.data.fileSize);

        // Fetch worksheets
        const sheetsRes = await (window as any).smartVyapar.getWorksheets(res.data.token);
        if (sheetsRes.success) {
          setWorksheets(sheetsRes.data);
          setSelectedWorksheet(sheetsRes.data[0] || '');
        }
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(`File picker error: ${err.message}`);
    }
  };

  const loadMappingAndParse = async () => {
    if (!selectedType || !fileToken) return;
    setErrorMsg(null);
    setInfoMsg('Parsing file structure...');
    try {
      // 1. Create Import Job in DB
      const jobRes = await (window as any).smartVyapar.createImportJob({
        importType: selectedType,
        fileName,
        fileHash: `hash-${Date.now()}`, // fileHash
        fileSize,
        worksheetName: selectedWorksheet || null,
        token: fileToken
      });

      if (!jobRes.success) throw new Error(jobRes.error);
      const job: ImportJob = jobRes.data;
      setCurrentJob(job);

      // 2. Parse file into DB rows
      const parseRes = await (window as any).smartVyapar.parseImportJob({
        jobId: job.id,
        token: fileToken,
        worksheetName: selectedWorksheet || undefined
      });
      if (!parseRes.success) throw new Error(parseRes.error);

      // 3. Load Auto-Mapping Profile
      const mappingRes = await (window as any).smartVyapar.getColumnMappingProfile({
        jobId: job.id,
        token: fileToken
      });
      if (!mappingRes.success) throw new Error(mappingRes.error);
      setMapping(mappingRes.data);

      // Determine available headers
      const preview = await (window as any).smartVyapar.getImportPreview({ jobId: job.id, pageIndex: 0, pageSize: 1 });
      if (preview.success && preview.data.items.length > 0) {
        const rawObj = JSON.parse(preview.data.items[0].sourceDataJson);
        setAvailableHeaders(Object.keys(rawObj));
      }

      setInfoMsg('File structure loaded. Please verify the column mappings.');
    } catch (err: any) {
      setErrorMsg(`Parsing error: ${err.message}`);
      setInfoMsg(null);
    }
  };

  const handleMapChange = (field: string, header: string) => {
    setMapping((prev: ImportMapping) => ({ ...prev, [field]: header }));
  };

  const runValidation = async () => {
    if (!currentJob) return;
    setErrorMsg(null);
    setInfoMsg('Executing validation engine...');
    try {
      // Save duplicate policy changes in main process
      await (window as any).smartVyapar.setImportDuplicatePolicy({
        jobId: currentJob.id,
        policy: dupPolicy
      });

      const res = await (window as any).smartVyapar.validateImport({
        jobId: currentJob.id,
        mapping
      });

      if (res.success) {
        if (res.data.isValid) {
          setStep(3);
          setPageIndex(0);
          loadPreviewRows(currentJob.id, 0);
          setInfoMsg('Validation completed. Review records and duplicates.');
        } else {
          setErrorMsg(res.data.errors.join('; '));
          setInfoMsg(null);
        }
      } else {
        setErrorMsg(res.error);
        setInfoMsg(null);
      }
    } catch (err: any) {
      setErrorMsg(`Validation error: ${err.message}`);
      setInfoMsg(null);
    }
  };

  const loadPreviewRows = async (jobId: string, pageIdx: number) => {
    try {
      const res = await (window as any).smartVyapar.getImportPreview({
        jobId,
        pageIndex: pageIdx,
        pageSize
      });
      if (res.success) {
        setPreviewRows(res.data.items);
        setPreviewTotal(res.data.totalItems);
      }
    } catch {}
  };

  const handlePageChange = (direction: 'PREV' | 'NEXT') => {
    if (!currentJob) return;
    const nextIdx = direction === 'PREV' ? Math.max(0, pageIndex - 1) : pageIndex + 1;
    if (nextIdx * pageSize < previewTotal) {
      setPageIndex(nextIdx);
      loadPreviewRows(currentJob.id, nextIdx);
    }
  };

  const executeImport = async () => {
    if (!currentJob) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setProgress(5);
    setStatusText('Initiating transaction context...');
    setStep(4);

    try {
      // Start async execution in background
      await (window as any).smartVyapar.executeImport({
        jobId: currentJob.id,
        transactionMode: txMode
      });

      // Poll status every 800ms
      const interval = setInterval(async () => {
        const statusRes = await (window as any).smartVyapar.getImportResult(currentJob.id);
        if (statusRes.success && statusRes.data) {
          const job: ImportJob = statusRes.data;
          setCurrentJob(job);

          if (job.status === 'PROCESSING') {
            setProgress(40);
            setStatusText('Executing business rules...');
          } else if (job.status === 'COMPLETED') {
            setProgress(100);
            setStatusText('Import completed successfully!');
            setInfoMsg(`Import Completed. Inserted: ${job.insertedRows}, Updated: ${job.updatedRows}, Skipped: ${job.skippedRows}.`);
            clearInterval(interval);
            loadHistory();
          } else if (job.status === 'COMPLETED_WITH_ERRORS') {
            setProgress(100);
            setStatusText('Import finished with some row errors.');
            setErrorMsg(`Errors occurred. Success: ${job.insertedRows + job.updatedRows}, Failed: ${job.failedRows}. Download Error Report.`);
            clearInterval(interval);
            loadHistory();
          } else if (job.status === 'FAILED') {
            setProgress(100);
            setStatusText('Import failed & changes rolled back.');
            setErrorMsg(job.errorSummary || 'Import execution failed.');
            clearInterval(interval);
            loadHistory();
          } else if (job.status === 'CANCELLED') {
            setProgress(100);
            setStatusText('Import cancelled.');
            clearInterval(interval);
            loadHistory();
          }
        }
      }, 800);
    } catch (err: any) {
      setErrorMsg(`Execution launch failed: ${err.message}`);
    }
  };

  const downloadErrorReport = async (jobId: string) => {
    try {
      const res = await (window as any).smartVyapar.exportImportErrorReport(jobId);
      if (res.success) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `error_report_job_${jobId.split('-').pop()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to download report: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green';
      case 'COMPLETED_WITH_ERRORS': return 'text-amber';
      case 'FAILED': return 'text-red';
      case 'CANCELLED': return 'text-gray';
      default: return 'text-blue';
    }
  };

  return (
    <div className="import-module glass-panel p-6">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            📥 Bulk Data Import Foundation
          </h1>
          <p className="text-gray text-sm mt-1">Migrate and import master structures and opening stock ledger values</p>
        </div>
        {step > 1 && (
          <button onClick={() => setStep(1)} className="btn-secondary">
            ← Change Import Type
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="alert alert-danger flex items-center justify-between mb-4">
          <span>❌ {errorMsg}</span>
          {currentJob && (currentJob.status === 'COMPLETED_WITH_ERRORS' || currentJob.status === 'FAILED') && (
            <button onClick={() => downloadErrorReport(currentJob.id)} className="btn-alert-action">
              Download Error Report CSV
            </button>
          )}
        </div>
      )}
      {infoMsg && <div className="alert alert-info mb-4">ℹ️ {infoMsg}</div>}

      {/* STEP 1: SELECT IMPORT TYPE */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Step 1: Select What You Want to Import</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {IMPORT_TYPES.map(it => (
              <div
                key={it.type}
                onClick={() => handleSelectType(it.type)}
                className="import-type-card cursor-pointer p-4 rounded-lg border glass-panel-hover transition-all"
              >
                <div className="text-3xl mb-2">{it.icon}</div>
                <h3 className="font-semibold text-white">{it.label}</h3>
                <p className="text-gray text-xs mt-1 leading-relaxed">{it.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-white mb-4 border-t pt-6">Previous Import Runs History</h2>
          <div className="history-table overflow-x-auto">
            <table className="w-full text-left text-sm text-gray">
              <thead className="text-xs uppercase bg-dark-card text-white">
                <tr>
                  <th className="p-3">Run Date</th>
                  <th className="p-3">Import Type</th>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Results (Ins / Upd / Fail)</th>
                  <th className="p-3">Error Log</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-dark-card hover:bg-dark-card-hover">
                    <td className="p-3 text-white">{new Date(h.createdAt).toLocaleString()}</td>
                    <td className="p-3">{h.importType}</td>
                    <td className="p-3 truncate max-w-xs">{h.fileName}</td>
                    <td className={`p-3 font-semibold ${getStatusColor(h.status)}`}>{h.status}</td>
                    <td className="p-3 text-white">
                      {h.insertedRows} / {h.updatedRows} / {h.failedRows}
                    </td>
                    <td className="p-3">
                      {(h.failedRows > 0 || h.status === 'FAILED') && (
                        <button onClick={() => downloadErrorReport(h.id)} className="btn-link text-amber hover:underline">
                          Download Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray">No import history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 2: FILE UPLOAD AND MAPPING */}
      {step === 2 && selectedType && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 glass-panel-inner p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              📂 1. Select Template & File
            </h2>
            <button onClick={downloadTemplate} className="btn-secondary w-full mb-4 py-3 flex items-center justify-center gap-2">
              📥 Download Sample {selectedType} Template
            </button>

            {!fileToken ? (
              <div
                onClick={handleSelectFile}
                className="dropzone border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue transition-all"
              >
                <div className="text-4xl mb-2">📁</div>
                <p className="text-white font-semibold text-sm">Click to Select CSV or XLSX File</p>
                <p className="text-gray text-xs mt-1">Limit: 25 MB max, 50,000 rows limit</p>
              </div>
            ) : (
              <div className="file-info bg-dark-card p-3 rounded-lg border">
                <p className="text-white font-semibold text-sm truncate">📄 {fileName}</p>
                <p className="text-gray text-xs mt-1">Size: {(fileSize / 1024).toFixed(1)} KB</p>
                
                {worksheets.length > 1 && (
                  <div className="mt-3">
                    <label className="text-gray text-xs block mb-1">Select Worksheet:</label>
                    <select
                      value={selectedWorksheet}
                      onChange={(e) => setSelectedWorksheet(e.target.value)}
                      className="select-input w-full"
                    >
                      {worksheets.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                )}

                <button onClick={loadMappingAndParse} className="btn-primary w-full mt-4">
                  Parse File Structure
                </button>
              </div>
            )}

            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-white mb-2">Duplicate Resolution Policy</h3>
              <select
                value={dupPolicy}
                onChange={(e) => setDupPolicy(e.target.value as ImportDuplicatePolicy)}
                className="select-input w-full"
                disabled={selectedType === 'OPENING_STOCK' || selectedType === 'SUPPLIER_OPENING_BALANCE'}
              >
                <option value="SKIP_DUPLICATES">Skip duplicate rows</option>
                <option value="UPDATE_EXISTING">Overwrite/Update existing records</option>
                <option value="FAIL_ON_DUPLICATE">Reject file on any duplicates</option>
              </select>
              {(selectedType === 'OPENING_STOCK' || selectedType === 'SUPPLIER_OPENING_BALANCE') && (
                <p className="text-amber text-xs mt-1 leading-normal">
                  ⚠️ Opening stock and balances ledger postings do not support update/overwrite for accounting safety.
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel-inner p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              ⚙️ 2. Map Columns explicitly
            </h2>
            {availableHeaders.length === 0 ? (
              <div className="p-12 text-center text-gray border rounded-lg">
                Please select and parse a file to see column mapping profiles.
              </div>
            ) : (
              <div>
                <p className="text-gray text-xs mb-4">Map your file columns to standard Smart Vyapar fields:</p>
                <div className="mapping-grid grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {columns.map((col: ImportColumnDefinition) => (
                    <div key={col.field} className="mapping-row flex flex-col gap-1 bg-dark-card p-3 rounded border">
                      <span className="text-white text-xs font-semibold flex items-center justify-between">
                        {col.label}
                        <span className="text-[10px] text-gray uppercase font-normal">{col.dataType}</span>
                      </span>
                      <p className="text-gray text-[10px] truncate">{col.description}</p>
                      <select
                        value={mapping[col.field] || ''}
                        onChange={(e) => handleMapChange(col.field, e.target.value)}
                        className="select-input text-xs mt-1"
                      >
                        <option value="">-- Do Not Import --</option>
                        {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t pt-4 flex justify-end gap-3">
                  <button onClick={runValidation} className="btn-primary py-2 px-6">
                    Run Validation Review & Verify
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW AND DUPLICATE REVIEW */}
      {step === 3 && currentJob && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Step 3: Validation Summary & Row Preview</h2>
              <div className="flex gap-4 mt-2 text-xs text-gray font-semibold">
                <span className="text-green">Valid: {currentJob.validRows}</span>
                <span className="text-red">Invalid: {currentJob.invalidRows}</span>
                <span className="text-amber">Duplicates Detected: {currentJob.duplicateRows}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-gray text-xs block mb-1">Transaction Mode:</label>
                <select
                  value={txMode}
                  onChange={(e) => setTxMode(e.target.value as ImportTransactionMode)}
                  className="select-input text-xs py-1"
                  disabled={currentJob.importType === 'OPENING_STOCK' || currentJob.importType === 'SUPPLIER_OPENING_BALANCE' || currentJob.importType === 'PRODUCT_PRICE'}
                >
                  <option value="VALID_ROWS_ONLY">Import valid rows, log and skip invalid</option>
                  <option value="ATOMIC_ALL_OR_NOTHING">Atomic - roll back all if any fail</option>
                </select>
              </div>
              <button onClick={executeImport} className="btn-primary py-2 px-6 mt-4">
                Confirm & Execute Import
              </button>
            </div>
          </div>

          <div className="preview-table overflow-x-auto max-h-[450px] border rounded-lg mb-4">
            <table className="w-full text-left text-xs text-gray">
              <thead className="bg-dark-card text-white font-semibold uppercase sticky top-0">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Key</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Validation Code / Message</th>
                  <th className="p-3">Source Row Data</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-dark-card-hover">
                    <td className="p-3 text-white font-bold">{r.rowNumber}</td>
                    <td className="p-3 text-white font-mono">{r.sourceKey || 'None'}</td>
                    <td className={`p-3 font-semibold ${r.action === 'INSERT' ? 'text-green' : r.action === 'UPDATE' ? 'text-blue' : 'text-gray'}`}>{r.action}</td>
                    <td className={`p-3 font-bold ${r.status === 'VALID' ? 'text-green' : r.status === 'INVALID' || r.status === 'FAILED' ? 'text-red' : 'text-amber'}`}>{r.status}</td>
                    <td className="p-3 text-white truncate max-w-xs">{r.errorMessage || 'Clean Check'}</td>
                    <td className="p-3 text-gray truncate max-w-xs font-mono">{r.sourceDataJson}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray">Showing page {pageIndex + 1} of {Math.ceil(previewTotal / pageSize)} ({previewTotal} rows matching filter)</span>
            <div className="flex gap-2">
              <button onClick={() => handlePageChange('PREV')} className="btn-secondary py-1 px-3" disabled={pageIndex === 0}>Prev</button>
              <button onClick={() => handlePageChange('NEXT')} className="btn-secondary py-1 px-3" disabled={(pageIndex + 1) * pageSize >= previewTotal}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT EXECUTION AND SUMMARY */}
      {step === 4 && (
        <div className="text-center py-12 glass-panel-inner rounded-lg">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white mb-2">{statusText}</h2>
            <div className="progress-bar-container bg-dark-card w-full h-4 rounded-full overflow-hidden mb-6 border">
              <div className="progress-bar-fill bg-blue h-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-gray text-sm mb-4">Please do not close the application or shut down your database during execution.</p>
            {currentJob && (currentJob.status === 'COMPLETED' || currentJob.status === 'COMPLETED_WITH_ERRORS' || currentJob.status === 'FAILED' || currentJob.status === 'CANCELLED') && (
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold text-white mb-4">Import Result Summary</h3>
                <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                  <div className="bg-dark-card p-3 rounded border">
                    <span className="text-green text-lg font-bold block">{currentJob.insertedRows}</span>
                    <span className="text-gray text-xs">Rows Inserted</span>
                  </div>
                  <div className="bg-dark-card p-3 rounded border">
                    <span className="text-blue text-lg font-bold block">{currentJob.updatedRows}</span>
                    <span className="text-gray text-xs">Rows Updated</span>
                  </div>
                  <div className="bg-dark-card p-3 rounded border">
                    <span className="text-red text-lg font-bold block">{currentJob.failedRows}</span>
                    <span className="text-gray text-xs">Rows Failed</span>
                  </div>
                </div>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setStep(1)} className="btn-primary px-6">
                    Return to Main Dashboard
                  </button>
                  {currentJob.failedRows > 0 && (
                    <button onClick={() => downloadErrorReport(currentJob.id)} className="btn-secondary px-6">
                      Download Error Report CSV
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
