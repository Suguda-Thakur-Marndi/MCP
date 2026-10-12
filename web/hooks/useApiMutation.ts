"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface UseApiMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (err: Error | ApiError, variables: TVariables) => void | Promise<void>;
  onSettled?: (data: TData | undefined, err: Error | ApiError | null, variables: TVariables) => void | Promise<void>;
}

export interface UseApiMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  loading: boolean;
  error: Error | ApiError | null;
  errorMessage: string | null;
  data: TData | undefined;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

/**
 * useApiMutation
 * Safe mutation hook with automatic duplicate-execution prevention (idempotency safety),
 * in-flight state tracking, and error handling.
 */
export function useApiMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData, TVariables> = {}
): UseApiMutationResult<TData, TVariables> {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  const inFlightRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const reset = useCallback(() => {
    setError(null);
    setData(undefined);
    setLoading(false);
  }, []);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    // Prevent duplicate mutations while one is already running
    if (inFlightRef.current) {
      throw new Error("A request is already in progress. Please wait before submitting again.");
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await mutationFnRef.current(variables);
      setData(result);
      setError(null);
      setLoading(false);
      inFlightRef.current = false;

      if (optionsRef.current.onSuccess) {
        await optionsRef.current.onSuccess(result, variables);
      }
      if (optionsRef.current.onSettled) {
        await optionsRef.current.onSettled(result, null, variables);
      }
      return result;
    } catch (err: unknown) {
      const parsedErr =
        err instanceof Error
          ? err
          : new Error(typeof err === "string" ? err : "Mutation failed");

      setError(parsedErr);
      setLoading(false);
      inFlightRef.current = false;

      if (optionsRef.current.onError) {
        await optionsRef.current.onError(parsedErr, variables);
      }
      if (optionsRef.current.onSettled) {
        await optionsRef.current.onSettled(undefined, parsedErr, variables);
      }
      throw parsedErr;
    }
  }, []);

  const mutate = useCallback(
    (variables: TVariables) => {
      void mutateAsync(variables).catch(() => {
        // Handled via state and onError callback
      });
    },
    [mutateAsync]
  );

  const errorMessage = error ? error.message : null;

  return {
    mutate,
    mutateAsync,
    loading,
    error,
    errorMessage,
    data,
    isSuccess: !loading && !error && data !== undefined,
    isError: !loading && error !== null,
    reset,
  };
}
