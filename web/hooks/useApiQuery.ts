"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface UseApiQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (err: Error) => void;
  initialData?: T;
}

export interface UseApiQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | ApiError | null;
  errorMessage: string | null;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<T | undefined>;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

/**
 * useApiQuery
 * Safe, unmount-protected async data fetching hook with AbortController,
 * polling support, and stale-response prevention.
 */
export function useApiQuery<T>(
  queryFn: (signal?: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
  const { enabled = true, refetchInterval, onSuccess, onError, initialData } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | ApiError | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryFnRef = useRef(queryFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    queryFnRef.current = queryFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const fetchData = useCallback(async (): Promise<T | undefined> => {
    // Abort any pending in-flight request for this hook
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await queryFnRef.current(controller.signal);
      if (isMountedRef.current && !controller.signal.aborted) {
        setData(result);
        setError(null);
        setLoading(false);
        onSuccessRef.current?.(result);
      }
      return result;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Request was intentionally cancelled (e.g., re-fetch or unmount)
        return undefined;
      }
      const parsedErr =
        err instanceof Error
          ? err
          : new Error(typeof err === "string" ? err : "An unexpected error occurred");

      if (isMountedRef.current) {
        setError(parsedErr);
        setLoading(false);
        onErrorRef.current?.(parsedErr);
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      void fetchData();
    } else {
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  // Polling support if refetchInterval > 0
  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchData();
      }
    }, refetchInterval);

    return () => clearInterval(timer);
  }, [enabled, refetchInterval, fetchData]);

  const errorMessage = error ? error.message : null;

  return {
    data,
    loading,
    error,
    errorMessage,
    isSuccess: !loading && !error && data !== undefined,
    isError: !loading && error !== null,
    refetch: fetchData,
    setData,
  };
}
