type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

function serializeError(error: unknown): LogContext {
  if (error == null) {
    return { error: null };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (typeof error !== 'object') {
    return { error: String(error) };
  }

  const anyErr = error as {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
    isAxiosError?: boolean;
    config?: { method?: string; url?: string; baseURL?: string };
    response?: { status?: number; data?: unknown };
  };

  const out: LogContext = {
    name: anyErr.name,
    message: anyErr.message,
    code: anyErr.code,
  };

  if (anyErr.isAxiosError) {
    out.kind = 'axios';
    out.method = anyErr.config?.method?.toUpperCase();
    out.url = anyErr.config?.url;
    out.baseURL = anyErr.config?.baseURL;
    out.status = anyErr.response?.status;
    if (__DEV__ && anyErr.response?.data != null) {
      out.responseData = anyErr.response.data;
    }
  }

  if (__DEV__ && anyErr.stack) {
    out.stack = anyErr.stack;
  }

  return out;
}

function emit(level: LogLevel, tag: string, message: string, context?: LogContext): void {
  const payload = {
    t: new Date().toISOString(),
    level,
    tag,
    message,
    ...context,
  };
  const line = `[RydAid:${tag}] ${message}`;

  switch (level) {
    case 'debug':
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.debug(line, payload);
      }
      break;
    case 'info':
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(line, payload);
      }
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(line, payload);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(line, payload);
      break;
  }
}

export const logger = {
  debug(tag: string, message: string, context?: LogContext): void {
    emit('debug', tag, message, context);
  },
  info(tag: string, message: string, context?: LogContext): void {
    emit('info', tag, message, context);
  },
  warn(tag: string, message: string, context?: LogContext): void {
    emit('warn', tag, message, context);
  },
  error(tag: string, message: string, error?: unknown, context?: LogContext): void {
    emit('error', tag, message, { ...serializeError(error), ...context });
  },
};

let globalHandlersInstalled = false;

/** Capture unhandled JS exceptions / promise rejections (dev + release). */
export function installGlobalErrorLogging(): void {
  if (globalHandlersInstalled) {
    return;
  }
  globalHandlersInstalled = true;

  const ErrorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
        setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;

  if (ErrorUtils?.getGlobalHandler && ErrorUtils?.setGlobalHandler) {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logger.error('Global', isFatal ? 'Fatal JS exception' : 'JS exception', error, { isFatal: Boolean(isFatal) });
      previous?.(error, isFatal);
    });
  }

  const tracking = globalThis as {
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
  };
  const prevRejection = tracking.onunhandledrejection;
  tracking.onunhandledrejection = (event) => {
    logger.error('Global', 'Unhandled promise rejection', event?.reason);
    if (typeof prevRejection === 'function') {
      prevRejection(event);
    }
  };
}
