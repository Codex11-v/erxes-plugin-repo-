import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  Badge,
  Button,
  Calendar,
  Card,
  Checkbox,
  Input,
  Label,
  Popover,
  Select,
  Table,
  Textarea,
} from "erxes-ui";
import type { ButtonProps } from "erxes-ui";
import {
  IconArrowLeft,
  IconCalendar,
  IconCamera,
  IconMicrophone,
  IconPlayerStop,
  IconSparkles,
  IconDownload,
  IconDeviceFloppy,
  IconCloudUpload,
  IconFileCheck,
  IconX,
} from "@tabler/icons-react";
import {
  GENERATE_MUTATION,
  SAVE_MUTATION,
  WORKS_QUERY,
} from "../graphql";
import { csvCell, download, parseRows, readFile, type GradeRow } from "../lib/files";
import { useRecording } from "../hooks/useRecording";

type Tool = "voice" | "lessons" | "ocr";
const info = {
  voice: {
    title: "Voice → Report",
    sub: "Turn spoken notes into a clear report for teacher review.",
    input: "Reviewed notes",
    placeholder: "Describe today’s lesson, participation, observations, and next steps…",
  },
  lessons: {
    title: "Lesson & Slides",
    sub: "Turn a topic into a lesson plan and presentation slides.",
    input: "Lesson topic and extra instructions",
    placeholder: "Example: Adding fractions, with a small-group activity…",
  },
  ocr: {
    title: "Image → Excel",
    sub: "Turn a paper class journal into an editable spreadsheet. Review the results and export them to Excel.",
    input: "",
    placeholder: "",
  },
};
const panel =
  "edusmart:rounded-2xl edusmart:border edusmart:border-border edusmart:bg-background edusmart:p-6";
const field =
  "edusmart:w-full edusmart:rounded-lg edusmart:border edusmart:border-border edusmart:bg-background edusmart:px-3 edusmart:py-3 edusmart:text-sm";
const button =
  "edusmart:inline-flex edusmart:items-center edusmart:justify-center edusmart:gap-2 edusmart:rounded-lg edusmart:border edusmart:border-border edusmart:px-4 edusmart:py-2 edusmart:text-sm edusmart:transition edusmart:hover:bg-accent edusmart:disabled:opacity-50";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="edusmart:flex edusmart:flex-col edusmart:gap-2 edusmart:text-sm">
      <span className="edusmart:font-medium">{label}</span>
      {children}
    </Label>
  );
}

function ActionButton({ className = "", variant = "outline", ...props }: ButtonProps) {
  const classes = [...new Set(`${button} ${className}`.split(/\s+/).filter(Boolean))].join(" ");
  return <Button className={classes} variant={variant} {...props} />;
}

function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TeacherDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const display = selected
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ulaanbaatar",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(selected)
    : "Select a date";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Select a date"
          aria-haspopup="dialog"
          className="edusmart:flex edusmart:w-full edusmart:items-center edusmart:justify-between edusmart:rounded-lg edusmart:border edusmart:border-border edusmart:bg-background edusmart:px-3 edusmart:py-3 edusmart:text-sm edusmart:font-normal"
        >
          {display}
          <IconCalendar size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="edusmart:w-auto edusmart:p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          onSelect={(date) => {
            if (date) onChange(dateValue(date));
            setOpen(false);
          }}
        />
      </Popover.Content>
    </Popover>
  );
}

export function ToolPage({ kind }: { kind: Tool }) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [duration, setDuration] = useState(40);
  const [teacher, setTeacher] = useState("");
  const [className, setClassName] = useState("8A");
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [exampleMode, setExampleMode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const slidesDialog = useRef<HTMLDialogElement>(null);
  const cameraDialog = useRef<HTMLDialogElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = slidesDialog.current;
    if (presenting) dialog?.showModal();
    return () => dialog?.close();
  }, [presenting]);
  useEffect(() => {
    const dialog = cameraDialog.current;
    if (cameraOpen) {
      dialog?.showModal();
      if (cameraVideo.current && cameraStream.current) {
        cameraVideo.current.srcObject = cameraStream.current;
        void cameraVideo.current.play().catch(() => {
          setError("Could not start the camera preview.");
        });
      }
    } else {
      dialog?.close();
    }
  }, [cameraOpen]);
  useEffect(
    () => () => {
      cameraStream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [generate] = useMutation(GENERATE_MUTATION);
  const [saveWork, { loading: saving }] = useMutation(SAVE_MUTATION);
  const history = useQuery(WORKS_QUERY, {
    variables: { kind, limit: 10, offset },
    fetchPolicy: "cache-and-network",
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed">("idle");
  const meta = info[kind];
  const accept =
    kind === "ocr"
      ? "image/png,image/jpeg,image/webp"
      : "audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav";
  const fileDescription =
    kind === "ocr" ? "PNG, JPG or WebP · up to 4 MB" : "WebM, MP4, MP3, OGG or WAV · up to 4 MB";
  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    const validType =
      kind === "ocr"
        ? ["image/png", "image/jpeg", "image/webp"].includes(nextFile.type)
        : [
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "audio/x-wav",
          ].includes(nextFile.type);
    if (!validType) {
      setFile(null);
      setError(
        kind === "ocr" ? "Choose a PNG, JPG, or WebP image." : "Choose a supported audio file.",
      );
      return;
    }
    if (nextFile.size > 4 * 1024 * 1024) {
      setFile(null);
      setError("The file must be 4 MB or smaller.");
      return;
    }
    setFile(nextFile);
    setError("");
    setNotice("");
  };
  const slides =
    content
      .split("---SLIDES---")[1]
      ?.split(/\n\s*---\s*\n/)
      .filter((value) => value.trim()) ?? [];
  const recording = useRecording((blob) => {
    const recorded = new File([blob], "voice-note", { type: blob.type });
    setFile(recorded);
    setNotice("Recording ready. Select “Transcribe audio” to review the transcript.");
  }, setError);
  const startCamera = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera capture.");
      }
      cameraStream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraOpen(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not open the camera: ${cause.message}`
          : "Could not open the camera. Check your camera permission.",
      );
    }
  };
  const closeCamera = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOpen(false);
  };
  const capturePhoto = async () => {
    const video = cameraVideo.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera preview is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not prepare the image.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) {
      setError("Could not save the image. Please try again.");
      return;
    }
    setFile(new File([blob], `journal-${Date.now()}.jpg`, { type: "image/jpeg" }));
    setError("");
    setNotice("Photo captured. Select “Extract table” to continue.");
    closeCamera();
  };
  const loadExample = () => {
    setError("");
    setFile(null);
    setSaveStatus("idle");
    setExampleMode(true);
    if (kind === "voice") {
      setText(
        "Sample notes: Grade 8A reviewed the water cycle today. 22 students attended. Most students explained evaporation and condensation correctly. Three students needed help distinguishing condensation from precipitation. Next lesson: start with a five-minute diagram review, then work in small groups.",
      );
      setTeacher("Alex Morgan");
      setClassName("8A");
      setSubject("Science");
      setTitle("Grade 8A · Water cycle lesson report");
      setContent(
        "LESSON SUMMARY\nGrade 8A reviewed the water cycle and the processes of evaporation, condensation, and precipitation.\n\nPARTICIPATION\n22 students attended. Most students explained evaporation and condensation accurately.\n\nOBSERVATIONS\nThree students would benefit from extra practice distinguishing condensation from precipitation.\n\nNEXT STEPS\nBegin the next lesson with a five-minute water-cycle diagram review, then use small groups to label and explain each stage.",
      );
      setNotice("Example preview loaded. This sample report was not generated by AI.");
      return;
    }
    if (kind === "lessons") {
      setGrade("6");
      setDuration(40);
      setSubject("Science");
      setTopic("The water cycle");
      setInstructions("Include a small-group diagram activity and a short exit ticket.");
      setTitle("Grade 6 Science · The water cycle");
      setContent(
        "LESSON PLAN\n\nGrade: 6\nSubject: Science\nDuration: 40 minutes\nTopic: The water cycle\n\nLearning goals\nStudents will describe evaporation, condensation, and precipitation and explain how water moves through the cycle.\n\nLesson sequence\n1. Warm-up · 5 min: Ask students where rain comes from and collect prior ideas.\n2. Teach · 10 min: Model the water cycle with a labeled diagram.\n3. Small groups · 15 min: Students draw and label the cycle, then explain each stage to a partner.\n4. Share · 5 min: Groups compare diagrams and correct one another’s labels.\n5. Exit ticket · 5 min: Students describe one complete journey a water droplet can take.\n\nCheck for understanding\nLook for accurate links between evaporation, condensation, and precipitation.\n\n---SLIDES---\nSlide 1 · The Water Cycle\nHow does water move through our world?\n\n---\nSlide 2 · Evaporation\nThe Sun warms water in rivers, lakes, and oceans. Liquid water changes into water vapor.\n\n---\nSlide 3 · Condensation\nWater vapor cools and forms tiny droplets. These droplets gather into clouds.\n\n---\nSlide 4 · Precipitation\nWhen droplets grow heavy, water falls as rain, snow, sleet, or hail.\n\n---\nSlide 5 · Draw, Label, Explain\nIn your group, draw the cycle and explain how water moves from one stage to the next.\n\n---\nSlide 6 · Exit Ticket\nDescribe one journey a water droplet can take through the water cycle.",
      );
      setNotice(
        "Example lesson and slides loaded. This is a demo preview; no AI request was made.",
      );
      return;
    }
    const sampleRows: GradeRow[] = [
      { name: "Student 1", score: 92, attendance: "Present" },
      { name: "Student 2", score: 85, attendance: "Present" },
      { name: "Student 3", score: 78, attendance: "Absent" },
    ];
    setRows(sampleRows);
    setContent(JSON.stringify(sampleRows));
    setTitle("Example: Grade 5 class journal");
    setExampleMode(true);
    setNotice("Example table loaded. This is demo data, not extracted from an image.");
  };
  const run = async (transcribe = false) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if ((kind === "voice" || kind === "lessons") && !consent) {
        throw new Error("Please provide consent before sending this information to AI.");
      }
      const media = transcribe || kind === "ocr";
      if (media && !file) throw new Error("Choose a file first.");
      const result = await generate({
        variables: {
          input: {
            kind: transcribe ? "transcribe" : kind,
            text: kind === "lessons" ? topic : text,
            subject,
            grade,
            duration,
            topic,
            instructions,
            teacher,
            className,
            date,
            ...(media && file
              ? { file: await readFile(file), mimeType: file.type.split(";")[0] }
              : {}),
          },
        },
      });
      const output = result.data?.edusmartGenerate;
      if (output === undefined) throw new Error("No response received. Please try again.");
      if (transcribe) {
        setText(output);
        setExampleMode(false);
        setNotice("Review and edit the transcript, then create your report.");
      } else {
        if (kind === "ocr") {
          const extracted = parseRows(output);
          setRows(extracted);
          if (!extracted.length) setNotice("No table was found. Try uploading a clearer image.");
        }
        setContent(output);
        setTitle((kind === "lessons" ? topic : text).trim().slice(0, 100) || meta.title);
        setExampleMode(false);
        setSaveStatus("idle");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const saveToEduSmart = async () => {
    setError("");
    setNotice("");
    try {
      const result = await saveWork({
        variables: {
          kind,
          title,
          content: kind === "ocr" ? JSON.stringify(rows) : content,
        },
      });
      if (!result.data?.edusmartSaveWork?._id) throw new Error("EduSmart did not confirm the save.");
      setSaveStatus("saved");
      setNotice("Saved in EduSmart. You can reopen it from Saved work below.");
      setOffset(0);
      await history.refetch({ kind, limit: 10, offset: 0 }).catch(() => undefined);
    } catch (cause) {
      setSaveStatus("failed");
      setError(cause instanceof Error ? cause.message : "Could not save this work in EduSmart.");
    }
  };
  const updateRow = (index: number, patch: Partial<GradeRow>) => {
      setSaveStatus("idle");
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  };
  const csvContent = () =>
    "\uFEFF" +
    [["Name", "Score", "Attendance"], ...rows.map((row) => [row.name, row.score, row.attendance])]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
  const exportCsv = () => download(csvContent(), "edusmart-grades.csv", "text/csv;charset=utf-8");
  const exportSlides = () => {
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    download(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(title)}</title><style>body{margin:0;background:#f2f0eb;color:#242822;font:24px system-ui}section{box-sizing:border-box;min-height:100vh;padding:8vw;white-space:pre-wrap;border-bottom:1px solid #aaa;break-after:page}@media print{section{min-height:95vh}}</style>${slides.map((slide) => `<section>${escape(slide.trim())}</section>`).join("")}</html>`,
      "edusmart-slides.html",
      "text/html;charset=utf-8",
    );
  };
  const scored = rows.filter((row) => row.score !== null);
  return (
    <div className="edusmart:mx-auto edusmart:max-w-7xl edusmart:p-6 edusmart:md:p-10">
      <Link
        to="/edusmart"
        className="edusmart:inline-flex edusmart:items-center edusmart:gap-2 edusmart:text-sm edusmart:text-muted-foreground"
      >
        <IconArrowLeft size={16} /> AI Home
      </Link>
      <h1 className="edusmart:mt-5 edusmart:text-2xl edusmart:font-semibold">{meta.title}</h1>
      <p className="edusmart:mb-8 edusmart:mt-3 edusmart:text-muted-foreground">{meta.sub}</p>
      <div className="edusmart:grid edusmart:items-start edusmart:gap-6 edusmart:lg:grid-cols-2">
        <Card
          className={`${panel} edusmart:flex edusmart:flex-col edusmart:gap-5`}
          role="region"
          aria-label="Input details"
        >
          <span className="edusmart:text-xs edusmart:tracking-widest edusmart:text-muted-foreground">
            01 / INPUT DETAILS
          </span>
          <ActionButton className={button} disabled={busy} onClick={loadExample}>
            Try an example
          </ActionButton>
          {kind === "voice" && (
            <>
              <ActionButton
                className={button}
                disabled={busy || recording.starting}
                onClick={() => (recording.recording ? recording.stop() : void recording.start())}
              >
                {recording.recording ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
                {recording.recording
                  ? "Stop recording"
                  : recording.starting
                    ? "Connecting microphone…"
                    : "Record a voice note (up to 2 minutes)"}
              </ActionButton>
              {recording.recording && <p role="status">Recording…</p>}
            </>
          )}
          {kind !== "lessons" && (
            <>
              {kind === "ocr" && (
                <ActionButton
                  className="edusmart:w-full"
                  disabled={busy}
                  onClick={() => void startCamera()}
                >
                  <IconCamera size={18} /> Take a photo
                </ActionButton>
              )}
              <Field label={kind === "ocr" ? "Class journal image" : "Audio file"}>
                <Input
                  ref={fileInput}
                  className="edusmart:sr-only"
                  type="file"
                  aria-label={
                    kind === "ocr" ? "Choose a class journal image" : "Choose an audio file"
                  }
                  disabled={busy || recording.recording}
                  accept={accept}
                  capture={kind === "ocr" ? "environment" : undefined}
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busy || recording.recording}
                  onClick={() => fileInput.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDraggingFile(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                      setDraggingFile(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingFile(false);
                    selectFile(event.dataTransfer.files[0]);
                  }}
                  className={`edusmart:flex edusmart:min-h-32 edusmart:w-full edusmart:flex-col edusmart:items-center edusmart:justify-center edusmart:gap-2 edusmart:rounded-xl edusmart:border edusmart:border-dashed edusmart:px-4 edusmart:py-5 edusmart:text-center edusmart:transition edusmart:disabled:cursor-not-allowed edusmart:disabled:opacity-50 ${draggingFile ? "edusmart:border-primary edusmart:bg-accent" : "edusmart:border-border edusmart:hover:bg-accent/50"}`}
                >
                  {file ? <IconFileCheck size={22} /> : <IconCloudUpload size={22} />}
                  <span className="edusmart:text-sm edusmart:font-medium">
                    {file ? file.name : "Drop a file here or browse"}
                  </span>
                  <span className="edusmart:text-xs edusmart:text-muted-foreground">
                    {file
                      ? `${(file.size / 1024).toFixed(0)} KB · Click to replace`
                      : fileDescription}
                  </span>
                </button>
              </Field>
              {file && (
                <ActionButton
                  className="edusmart:self-start edusmart:text-muted-foreground"
                  disabled={busy}
                  onClick={() => setFile(null)}
                >
                  <IconX size={16} /> Remove file
                </ActionButton>
              )}
              {kind === "voice" && (
                <ActionButton
                  className={button}
                  disabled={!file || busy || recording.recording || !consent}
                  onClick={() => void run(true)}
                >
                  Transcribe audio
                </ActionButton>
              )}
            </>
          )}
          {kind === "voice" && (
            <div className="edusmart:grid edusmart:grid-cols-2 edusmart:gap-4">
              <Field label="Teacher name">
                <Input
                  className={field}
                  maxLength={120}
                  value={teacher}
                  onChange={(event) => setTeacher(event.target.value)}
                />
              </Field>
              <div className="edusmart:flex edusmart:flex-col edusmart:gap-2 edusmart:text-sm">
                <span className="edusmart:font-medium">Date</span>
                <TeacherDateField value={date} onChange={setDate} />
              </div>
              <Field label="Class">
                <Input
                  className={field}
                  maxLength={80}
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </Field>
              <Field label="Subject">
                <Input
                  className={field}
                  maxLength={120}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </Field>
            </div>
          )}
          {kind === "lessons" && (
            <div className="edusmart:grid edusmart:grid-cols-2 edusmart:gap-4">
              <Field label="Grade">
                <Select value={grade} onValueChange={setGrade}>
                  <Select.Trigger className={field} aria-label="Grade">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {Array.from({ length: 12 }, (_, index) => (
                      <Select.Item key={index + 1} value={String(index + 1)}>
                        {index + 1}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Duration (minutes)">
                <Input
                  className={field}
                  type="number"
                  min={10}
                  max={180}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </Field>
              <div className="edusmart:col-span-2">
                <Field label="Subject">
                  <Input
                    className={field}
                    maxLength={120}
                    value={subject}
                    placeholder="Science"
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </Field>
              </div>
              <div className="edusmart:col-span-2">
                <Field label="Topic">
                  <Input
                    className={field}
                    maxLength={300}
                    value={topic}
                    placeholder="Example: Newton’s laws of motion"
                    onChange={(event) => setTopic(event.target.value)}
                  />
                </Field>
              </div>
              <div className="edusmart:col-span-2">
                <Field label="Additional instructions">
                  <Textarea
                    className={field}
                    rows={3}
                    maxLength={4000}
                    value={instructions}
                    placeholder="Teaching approach, student needs, or activity ideas…"
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}
          {kind === "voice" && (
            <Field label={meta.input}>
              <Textarea
                className={field}
                rows={10}
                maxLength={16000}
                value={text}
                placeholder={meta.placeholder}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          )}
          {(kind === "voice" || kind === "lessons") && (
            <label className="edusmart:flex edusmart:items-start edusmart:gap-2 edusmart:text-xs edusmart:text-muted-foreground">
              <Checkbox
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
              />
              {kind === "voice"
                ? "I agree to send this text or recording to the configured AI service. I will not include personal information without permission."
                : "I agree to send this form to the configured AI service. I will not include students’ personal information."}
            </label>
          )}
          <ActionButton
            variant="default"
            disabled={
              busy ||
              recording.recording ||
              (kind === "ocr" ? !file : kind === "lessons" ? !topic.trim() : !text.trim()) ||
              (kind === "lessons" &&
                (!topic.trim() || !subject.trim() || duration < 10 || duration > 180)) ||
              ((kind === "voice" || kind === "lessons") && !consent) ||
              (kind === "voice" && (!teacher.trim() || !className.trim() || !date))
            }
            onClick={() => void run()}
          >
            <IconSparkles size={18} />
            {busy
              ? "Processing…"
              : kind === "ocr"
                ? "Extract table"
                : kind === "voice"
                  ? "Create report"
                  : "Generate lesson plan & slides"}
          </ActionButton>
          <p className="edusmart:text-xs edusmart:leading-relaxed edusmart:text-muted-foreground">
            Text, images, and audio are sent to the configured AI service. Review and edit the
            results before using them.
          </p>
        </Card>
        <Card
          className={`${panel} edusmart:min-w-0 edusmart:flex edusmart:flex-col edusmart:gap-5`}
          role="region"
          aria-label="Results"
          aria-busy={busy}
        >
          <div className="edusmart:flex edusmart:flex-wrap edusmart:items-center edusmart:justify-between edusmart:gap-3">
            <span className="edusmart:text-xs edusmart:tracking-widest edusmart:text-muted-foreground">
              02 / REVIEW & SAVE
            </span>
            <Badge variant="info">
              {exampleMode ? "Example · Demo data" : "AI · Teacher review"}
            </Badge>
          </div>
          {error && (
            <p role="alert" className="edusmart:text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="edusmart:text-sm">
              {notice}
            </p>
          )}
          {busy && (
            <p role="status">AI is processing your request. This may take about a minute.</p>
          )}
          {!content && !busy && (
            <div className="edusmart:py-20 edusmart:text-center edusmart:text-muted-foreground">
              <IconSparkles size={34} className="edusmart:mx-auto edusmart:mb-4" />
              <p>Your result will appear here.</p>
              <p className="edusmart:mt-2 edusmart:text-xs">Enter your details to get started.</p>
            </div>
          )}
          {content && (
            <>
              <Field label="Title">
                <Input
                  className={field}
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              {kind === "ocr" ? (
                <>
                  <div className="edusmart:overflow-auto">
                    <Table className="edusmart:w-full edusmart:text-sm">
                      <Table.Caption className="edusmart:mb-3 edusmart:text-left">
                        {rows.length} students · Average{" "}
                        {scored.length
                          ? (
                              scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length
                            ).toFixed(1)
                          : "—"}
                      </Table.Caption>
                      <Table.Header>
                        <Table.Row>
                          <Table.Head scope="col">Name</Table.Head>
                          <Table.Head scope="col">Score / 100</Table.Head>
                          <Table.Head scope="col">Attendance</Table.Head>
                          <Table.Head scope="col">Actions</Table.Head>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {rows.map((row, index) => (
                          <Table.Row key={index}>
                            <Table.Cell>
                              <Input
                                aria-label={`Name ${index + 1}`}
                                className={field}
                                value={row.name}
                                onChange={(event) => updateRow(index, { name: event.target.value })}
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                aria-label={`Score ${index + 1}`}
                                className={field}
                                type="number"
                                min={0}
                                max={100}
                                value={row.score ?? ""}
                                onChange={(event) => {
                                  const value =
                                    event.target.value === "" ? null : Number(event.target.value);
                                  if (
                                    value === null ||
                                    (Number.isFinite(value) && value >= 0 && value <= 100)
                                  )
                                    updateRow(index, { score: value });
                                }}
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                aria-label={`Attendance ${index + 1}`}
                                className={field}
                                value={row.attendance}
                                onChange={(event) =>
                                  updateRow(index, { attendance: event.target.value })
                                }
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <ActionButton
                                className={button}
                                aria-label={`Delete row ${index + 1}`}
                                onClick={() =>
                                  setRows((current) => current.filter((_, i) => i !== index))
                                }
                              >
                                ×
                              </ActionButton>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </div>
                  {!rows.length && <p>The table is empty. Add a row or upload another image.</p>}
                  <ActionButton
                    className={button}
                    disabled={rows.length >= 200}
                    onClick={() =>
                      setRows((current) => [...current, { name: "", score: null, attendance: "" }])
                    }
                  >
                    Add row
                  </ActionButton>
                </>
              ) : (
                <Field label="Edit content">
                  <Textarea
                    className={`${field} edusmart:leading-relaxed`}
                    rows={19}
                    maxLength={100000}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </Field>
              )}
              <div className="edusmart:flex edusmart:flex-wrap edusmart:gap-2">
                <ActionButton
                  className={button}
                  disabled={
                    saving || busy || !title.trim() || !content.trim()
                  }
                  onClick={() => void saveToEduSmart()}
                >
                  <IconDeviceFloppy size={16} />
                  {saving
                    ? "Saving in EduSmart…"
                    : saveStatus === "saved"
                      ? "Saved in EduSmart"
                      : saveStatus === "failed"
                        ? "Try saving again"
                        : "Save in EduSmart"}
                </ActionButton>
                <ActionButton
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    kind === "ocr"
                      ? exportCsv()
                      : download(content, `edusmart-${kind}.md`, "text/markdown;charset=utf-8")
                  }
                >
                  <IconDownload size={16} />
                  {kind === "ocr" ? "Download CSV for Excel" : "Download text"}
                </ActionButton>
                {slides.length > 0 && (
                  <>
                    <ActionButton
                      className={button}
                      onClick={() => {
                        setSlideIndex(0);
                        setPresenting(true);
                      }}
                    >
                      Present slides
                    </ActionButton>
                    <ActionButton className={button} onClick={exportSlides}>
                      Download slides (HTML)
                    </ActionButton>
                  </>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
      <Card className={`${panel} edusmart:mt-8`} role="region" aria-label="Saved work">
        <h2 className="edusmart:mb-4 edusmart:text-lg edusmart:font-semibold">Saved work</h2>
        {history.loading && <p role="status">Loading saved work…</p>}
        {history.error && (
          <p role="alert" className="edusmart:text-destructive">
            {history.error.message}{" "}
            <ActionButton className={button} onClick={() => void history.refetch()}>
              Retry
            </ActionButton>
          </p>
        )}
        {!history.loading && !history.error && !history.data?.edusmartWorks.length && (
          <p className="edusmart:text-muted-foreground">Nothing saved yet.</p>
        )}
        <ul className="edusmart:grid edusmart:gap-2">
          {history.data?.edusmartWorks.map((work) => (
            <li key={work._id}>
              <ActionButton
                className={`${button} edusmart:w-full edusmart:justify-between edusmart:text-left`}
                disabled={busy}
                onClick={() => {
                  try {
                    if (kind === "ocr") setRows(parseRows(work.content));
                    setContent(work.content);
                    setTitle(work.title);
                    setExampleMode(false);
                    setSaveStatus("idle");
                    setError("");
                    setNotice("Saved work opened.");
                  } catch {
                    setError("Could not open the saved table.");
                  }
                }}
              >
                <span>{work.title}</span>
                <time className="edusmart:text-xs edusmart:text-muted-foreground">
                  {new Date(work.createdAt).toLocaleDateString("en-US")}
                </time>
              </ActionButton>
            </li>
          ))}
        </ul>
        <div className="edusmart:mt-4 edusmart:flex edusmart:gap-2">
          <ActionButton
            className={button}
            disabled={!offset || history.loading}
            onClick={() => setOffset((current) => Math.max(0, current - 10))}
          >
            Previous
          </ActionButton>
          <ActionButton
            className={button}
            disabled={history.loading || (history.data?.edusmartWorks.length ?? 0) < 10 || offset >= 10000}
            onClick={() => setOffset((current) => current + 10)}
          >
            Next
          </ActionButton>
        </div>
      </Card>
      {presenting && (
        <dialog
          ref={slidesDialog}
          onCancel={() => setPresenting(false)}
          aria-label="Lesson slides"
          onKeyDown={(event) => {
            if (event.key === "Escape") setPresenting(false);
            if (event.key === "ArrowRight")
              setSlideIndex((index) => Math.min(slides.length - 1, index + 1));
            if (event.key === "ArrowLeft") setSlideIndex((index) => Math.max(0, index - 1));
          }}
          className="edusmart:fixed edusmart:inset-0 edusmart:m-0 edusmart:h-screen edusmart:max-h-none edusmart:w-screen edusmart:max-w-none edusmart:border-0 edusmart:z-50 edusmart:flex edusmart:flex-col edusmart:bg-background edusmart:p-8 edusmart:text-foreground"
        >
          <div className="edusmart:flex edusmart:justify-between">
            <span>
              {slideIndex + 1} / {slides.length}
            </span>
            <ActionButton autoFocus className={button} onClick={() => setPresenting(false)}>
              Close (Esc)
            </ActionButton>
          </div>
          <div className="edusmart:mx-auto edusmart:flex edusmart:w-full edusmart:max-w-4xl edusmart:flex-1 edusmart:items-center edusmart:overflow-auto edusmart:whitespace-pre-wrap edusmart:text-2xl edusmart:leading-relaxed">
            {slides[slideIndex]}
          </div>
          <div className="edusmart:flex edusmart:justify-center edusmart:gap-4">
            <ActionButton
              className={button}
              disabled={!slideIndex}
              onClick={() => setSlideIndex((index) => index - 1)}
            >
              ← Previous
            </ActionButton>
            <ActionButton
              className={button}
              disabled={slideIndex >= slides.length - 1}
              onClick={() => setSlideIndex((index) => index + 1)}
            >
              Next →
            </ActionButton>
          </div>
        </dialog>
      )}
      {cameraOpen && (
        <dialog
          ref={cameraDialog}
          onCancel={(event) => {
            event.preventDefault();
            closeCamera();
          }}
          aria-label="Take a class journal photo"
          className="edusmart:fixed edusmart:inset-0 edusmart:m-0 edusmart:flex edusmart:h-screen edusmart:max-h-none edusmart:w-screen edusmart:max-w-none edusmart:flex-col edusmart:items-center edusmart:justify-center edusmart:gap-4 edusmart:border-0 edusmart:bg-background edusmart:p-6 edusmart:text-foreground"
        >
          <video
            ref={cameraVideo}
            autoPlay
            playsInline
            muted
            aria-label="Camera preview"
            className="edusmart:max-h-[75vh] edusmart:w-full edusmart:max-w-4xl edusmart:rounded-xl edusmart:bg-black edusmart:object-contain"
          />
          <div className="edusmart:flex edusmart:gap-3">
            <ActionButton variant="default" onClick={() => void capturePhoto()}>
              <IconCamera size={18} /> Capture photo
            </ActionButton>
            <ActionButton onClick={closeCamera}>Cancel</ActionButton>
          </div>
        </dialog>
      )}
    </div>
  );
}
