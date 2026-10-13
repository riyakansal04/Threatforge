import { useCallback, useEffect, useRef, useState } from 'react';
import { currentCodebaseId } from './client.js';

const stringCache = new Map();
const functionCache = new WeakMap();

function scopedCacheKey(cacheKey) {
  return `${currentCodebaseId() || '0'}:${cacheKey}`;
}

function getCached(fn, cacheKey) {
  if (cacheKey) return stringCache.get(scopedCacheKey(cacheKey));
  return functionCache.get(fn)?.get(currentCodebaseId() || '0');
}

function setCached(fn, cacheKey, data) {
  if (cacheKey) {
    stringCache.set(scopedCacheKey(cacheKey), data);
    return;
  }
  const codebaseId = currentCodebaseId() || '0';
  const cache = functionCache.get(fn) || new Map();
  cache.set(codebaseId, data);
  functionCache.set(fn, cache);
}

export function useApi(fn, cacheKey = '') {
  const requestId = useRef(0);
  const [state, setState] = useState(() => {
    const cached = getCached(fn, cacheKey);
    return { data: cached || null, loading: !cached, error: '' };
  });

  const load = useCallback(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => {
        if (requestId.current !== id) return;
        setCached(fn, cacheKey, data);
        setState({ data, loading: false, error: '' });
      })
      .catch((e) => {
        if (requestId.current !== id) return;
        setState((s) => ({ data: s.data, loading: false, error: e.message }));
      });
  }, [fn, cacheKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('threatforge:refresh', refresh);
    return () => window.removeEventListener('threatforge:refresh', refresh);
  }, [load]);
  return { ...state, reload: load };
}
