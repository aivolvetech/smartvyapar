export default function PurchaseStatusBadge({ status }: { status: string }) {
  const cls = status === 'POSTED' ? 'badge-connected' : status === 'CANCELLED' ? 'badge-offline' : '';
  return <span className={`pill-badge ${cls}`}>{status}</span>;
}
