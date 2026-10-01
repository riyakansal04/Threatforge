import { useCallback, useEffect, useState } from 'react';

export function useApi(fn) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((e) => setState({ data: null, loading: false, error: e.message }));
  }, [fn]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('threatforge:refresh', refresh);
    return () => window.removeEventListener('threatforge:refresh', refresh);
  }, [load]);
  return { ...state, reload: load };
}
