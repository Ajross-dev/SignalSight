
interface StatsCardProps {
  title: string;
  value: string;
  description: string;
}

function StatsCard({ title, value, description }: StatsCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-title">{title}</p>
      <h2 className="stat-value">{value}</h2>
      <p className="stat-description">{description}</p>
    </div>
  );
}

export default StatsCard;
