export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-pos border border-pos-line bg-pos-surface2 px-3.5 py-3">
      <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-pos-muted">{label}</span>
      <strong className="text-xl font-black text-pos-ink">{value}</strong>
    </div>
  );
}
