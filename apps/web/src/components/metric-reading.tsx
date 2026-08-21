export function MetricReading({
  label,
  value,
  secondary,
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}) {
  return (
    <div className="metric-reading">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}
