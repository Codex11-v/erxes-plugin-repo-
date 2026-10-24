import { useEffect, useRef, useState } from "react";

export function useRecording(onComplete: (blob: Blob) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const acquiring = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const fail = useRef(onError);
  fail.current = onError;
  const release = () => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, []);
  const start = async () => {
    if (acquiring.current || recorder.current?.state === "recording") return;
    acquiring.current = true;
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Энэ браузерт бичлэг дэмжигдэхгүй. Дууны файл оруулах боломжтой.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = instance;
      const chunks: BlobPart[] = [];
      let size = 0;
      instance.ondataavailable = (event) => {
        chunks.push(event.data);
        size += event.data.size;
        if (size > 4 * 1024 * 1024 && instance.state === "recording") instance.stop();
      };
      instance.onerror = () => {
        release();
        if (alive.current) {
          setRecording(false);
          fail.current("Бичлэг тасалдлаа. Дахин оролдоно уу.");
        }
      };
      instance.onstop = () => {
        release();
        if (!alive.current) return;
        setRecording(false);
        complete.current(
          new Blob(chunks, { type: instance.mimeType.split(";")[0] || "audio/webm" }),
        );
      };
      instance.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 120000);
    } catch (error) {
      release();
      if (alive.current)
        fail.current(error instanceof Error ? error.message : "Микрофоны эрхийг шалгана уу.");
    } finally {
      acquiring.current = false;
      if (alive.current) setStarting(false);
    }
  };
  return {
    recording,
    starting,
    start,
    stop: () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
  };
}
