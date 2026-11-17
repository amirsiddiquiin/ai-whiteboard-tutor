"use client";

import { useCallback, useEffect, useState } from "react";

import type { GeneratedLesson } from "@/features/lesson/schema";
import {
  narrationResponseSchema,
  type CueTiming,
  type NarrationResponse,
} from "@/features/narration/schema";

export type NarrationStatus = "loading" | "ready" | "error";

export interface NarrationAudioState {
  status: NarrationStatus;
  audioUrl: string | null;
  cueTimings: CueTiming[];
  error: string | null;
}

const LOADING_STATE: NarrationAudioState = {
  status: "loading",
  audioUrl: null,
  cueTimings: [],
  error: null,
};

const inFlightNarrationRequests = new Map<string, Promise<NarrationResponse>>();

export function base64AudioToObjectUrl(audioBase64: string, mimeType: string) {
  const binary = window.atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function responseError(data: unknown) {
  if (typeof data !== "object" || data === null || !("error" in data)) return undefined;
  const error = (data as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : undefined;
}

function requestNarration(lesson: GeneratedLesson) {
  const existing = inFlightNarrationRequests.get(lesson.id);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch("/api/narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson }),
    });
    const data: unknown = await response.json();
    if (!response.ok) throw new Error(responseError(data) ?? "Narration could not be generated.");
    const parsed = narrationResponseSchema.safeParse(data);
    if (!parsed.success) throw new Error("The narration response was invalid. Please retry.");
    return parsed.data;
  })();

  inFlightNarrationRequests.set(lesson.id, request);
  const removeRequest = () => {
    if (inFlightNarrationRequests.get(lesson.id) === request) {
      inFlightNarrationRequests.delete(lesson.id);
    }
  };
  void request.then(removeRequest, removeRequest);
  return request;
}

export function useNarrationAudio(lesson: GeneratedLesson) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<NarrationAudioState>(LOADING_STATE);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    async function loadNarration() {
      try {
        const narration = await requestNarration(lesson);
        if (disposed) return;
        objectUrl = base64AudioToObjectUrl(narration.audioBase64, narration.mimeType);
        setState({
          status: "ready",
          audioUrl: objectUrl,
          cueTimings: narration.cueTimings,
          error: null,
        });
      } catch (error) {
        if (disposed) return;
        setState({
          status: "error",
          audioUrl: null,
          cueTimings: [],
          error: error instanceof Error ? error.message : "Narration could not be generated.",
        });
      }
    }

    void loadNarration();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lesson, version]);

  const retry = useCallback(() => {
    setState(LOADING_STATE);
    setVersion((current) => current + 1);
  }, []);
  return { ...state, retry };
}
