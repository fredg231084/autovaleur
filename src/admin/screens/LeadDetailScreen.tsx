import { useParams } from 'react-router-dom';

export function LeadDetailScreen() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Lead {id}</h1>
      <p className="mt-2 text-sm text-slate-500">Bientôt disponible.</p>
    </div>
  );
}
