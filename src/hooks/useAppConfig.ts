import { useCallback, useEffect, useState } from 'react';
import { fetchAppConfig, getCachedAppConfig, type AppConfig } from '../api/appConfig';

export function useAppConfig() {
  // Start from the launch-preloaded config so dashboards don't paint once with every feature off.
  const [config, setConfig] = useState<AppConfig | null>(() => getCachedAppConfig());
  const [loading, setLoading] = useState(() => getCachedAppConfig() == null);

  const reload = useCallback(() => {
    if (getCachedAppConfig() == null) setLoading(true);
    return fetchAppConfig(true)
      .then(setConfig)
      // Keep the last good config on a failed refresh instead of switching every feature off.
      .catch(() => setConfig(getCachedAppConfig()))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, reload };
}
