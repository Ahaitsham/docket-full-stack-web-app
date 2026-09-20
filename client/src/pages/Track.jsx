import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Segmented } from '../components/ui.jsx';
import Diet from './Diet.jsx';
import Money from './Money.jsx';
import Gym from './Gym.jsx';

const ALL = [
  { value: 'diet', label: 'Diet' },
  { value: 'money', label: 'Money' },
  { value: 'gym', label: 'Gym' },
];

export default function Track() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const enabled = ALL.filter((o) => user.modules[o.value]);
  if (enabled.length === 0) return <Navigate to="/settings" replace />;
  const current = loc.pathname.split('/')[2];
  const active = enabled.find((o) => o.value === current) ? current : enabled[0].value;

  return (
    <div className="space-y-4">
      {enabled.length > 1 && <Segmented value={active} onChange={(v) => nav(`/track/${v}`, { replace: true })} options={enabled} />}
      <Routes>
        <Route index element={<Navigate to={enabled[0].value} replace />} />
        {user.modules.diet && <Route path="diet" element={<Diet />} />}
        {user.modules.money && <Route path="money" element={<Money />} />}
        {user.modules.gym && <Route path="gym" element={<Gym />} />}
        <Route path="*" element={<Navigate to={enabled[0].value} replace />} />
      </Routes>
    </div>
  );
}
