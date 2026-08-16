import { defaultPillColor } from '../utils/format';

export default function Pill({ value, colorMap }) {
  if (value === null || value === undefined || value === '') return <span className="faint">—</span>;
  const color = (colorMap && colorMap[value]) || defaultPillColor(value);
  return <span className={`pill pill-${color}`}>{String(value).replace(/_/g, ' ')}</span>;
}
