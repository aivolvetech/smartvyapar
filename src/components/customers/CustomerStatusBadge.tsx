export default function CustomerStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`pill-badge ${active ? 'badge-connected' : 'badge-offline'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
