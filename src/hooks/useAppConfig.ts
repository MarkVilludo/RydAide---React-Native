import { useCallback, useEffect, useState } from 'react';
import { fetchAppConfig, getCachedAppConfig, type AppConfig } from '../api/appConfig';

export function useAppConfig() {
  // Start from the launch-preloaded config so dashboards don't paint once with every feature off.
  const [config, setConfig] = useState<AppConfig | null>(() => getCachedAppConfig());
  const [loading, setLoading] = useState(() => getCachedAppConfig() == null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const reload = useCallback(() => {
    if (getCachedAppConfig() == null) setLoading(true);
    return fetchAppConfig(true)
      .then((next) => {
        setConfig(next);
        setRefreshFailed(false);
        return next;
      })
      // Keep the last good config on a failed refresh instead of switching every feature off.
      .catch(() => {
        setRefreshFailed(true);
        setConfig(getCachedAppConfig());
        return getCachedAppConfig();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, reload, refreshFailed };
}
