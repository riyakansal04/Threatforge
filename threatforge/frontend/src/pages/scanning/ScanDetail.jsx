import { Navigate, useParams } from 'react-router-dom';

export default function ScanDetail() {
  const { id } = useParams();
  return <Navigate to={`/scanning/overview?scan_id=${id}`} replace />;
}
