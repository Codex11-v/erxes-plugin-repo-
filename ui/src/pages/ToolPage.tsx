import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  IconArrowLeft,
  IconMicrophone,
  IconPlayerStop,
  IconSparkles,
  IconDownload,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { GENERATE_MUTATION, SAVE_MUTATION, WORKS_QUERY } from "../graphql";
import { csvCell, download, parseRows, readFile, type GradeRow } from "../lib/files";
import { useRecording } from "../hooks/useRecording";

type Tool = "voice" | "lessons" | "ocr";
const info = {
  voice: {
    title: "Дуу → Тайлан",
    sub: "Ярьсан тэмдэглэлээ багшийн хяналттай, цэгцтэй тайлан болго.",
    input: "Хянасан тэмдэглэл",
    placeholder: "Өнөөдрийн хичээл, оролцоо, ажиглалт, дараагийн алхмаа бичнэ үү…",
  },
  lessons: {
    title: "Хичээл & Слайд",
    sub: "Сэдвээс төлөвлөгөө, төлөвлөгөөнөөс слайд.",
    input: "Хичээлийн сэдэв, нэмэлт заавар",
    placeholder: "Жишээ: Энгийн бутархайг нэмэх. Бүлгээр ажиллах дасгалтай…",
  },
  ocr: {
    title: "Зураг → Excel",
    sub: "Цаасан журналаа засварлах хүснэгт болго. Танилтыг хянаад Excel-д нээнэ.",
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
    <label className="edusmart:flex edusmart:flex-col edusmart:gap-2 edusmart:text-sm">
      <span className="edusmart:font-medium">{label}</span>
      {children}
    </label>
  );
}

export function ToolPage({ kind }: { kind: Tool }) {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [duration, setDuration] = useState(40);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const slidesDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = slidesDialog.current;
    if (presenting) dialog?.showModal();
    return () => dialog?.close();
  }, [presenting]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [generate] = useMutation(GENERATE_MUTATION);
  const [save, { loading: saving }] = useMutation(SAVE_MUTATION);
  const history = useQuery(WORKS_QUERY, {
    variables: { kind, limit: 10, offset },
    fetchPolicy: "cache-and-network",
  });
  const meta = info[kind];
  const slides =
    content
      .split("---SLIDES---")[1]
      ?.split(/\n\s*---\s*\n/)
      .filter((value) => value.trim()) ?? [];
  const recording = useRecording((blob) => {
    const recorded = new File([blob], "Тэмдэглэл", { type: blob.type });
    setFile(recorded);
    setNotice("Бичлэг бэлэн. «Текст болгох» дээр дарж танилтыг хянана уу.");
  }, setError);
  const run = async (transcribe = false) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const media = transcribe || kind === "ocr";
      if (media && !file) throw new Error("Эхлээд файл оруулна уу.");
      const result = await generate({
        variables: {
          input: {
            kind: transcribe ? "transcribe" : kind,
            text,
            subject,
            grade,
            duration,
            ...(media && file
              ? { file: await readFile(file), mimeType: file.type.split(";")[0] }
              : {}),
          },
        },
      });
      const output = result.data?.edusmartGenerate;
      if (output === undefined) throw new Error("Хариу ирсэнгүй. Дахин оролдоно уу.");
      if (transcribe) {
        setText(output);
        setNotice("Текстийг хянаж засаад тайлангаа үүсгэнэ үү.");
      } else {
        if (kind === "ocr") {
          const extracted = parseRows(output);
          setRows(extracted);
          if (!extracted.length) setNotice("Зургаас хүснэгт олдсонгүй. Илүү тод зураг оруулна уу.");
        }
        setContent(output);
        setTitle(text.trim().slice(0, 100) || meta.title);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };
  const saveWork = async () => {
    setError("");
    setNotice("");
    try {
      await save({
        variables: { kind, title, content: kind === "ocr" ? JSON.stringify(rows) : content },
      });
      setNotice("Ажил хадгалагдлаа.");
      setOffset(0);
      await history.refetch({ kind, limit: 10, offset: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Хадгалж чадсангүй.");
    }
  };
  const updateRow = (index: number, patch: Partial<GradeRow>) =>
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  const exportCsv = () =>
    download(
      "\uFEFF" +
        [["Нэр", "Оноо", "Ирц"], ...rows.map((row) => [row.name, row.score, row.attendance])]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
      "edusmart-grades.csv",
      "text/csv;charset=utf-8",
    );
  const exportSlides = () => {
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    download(
      `<!doctype html><html lang="mn"><meta charset="utf-8"><title>${escape(title)}</title><style>body{margin:0;background:#f2f0eb;color:#242822;font:24px system-ui}section{box-sizing:border-box;min-height:100vh;padding:8vw;white-space:pre-wrap;border-bottom:1px solid #aaa;break-after:page}@media print{section{min-height:95vh}}</style>${slides.map((slide) => `<section>${escape(slide.trim())}</section>`).join("")}</html>`,
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
        <IconArrowLeft size={16} /> AI төв
      </Link>
      <h1 className="edusmart:mt-5 edusmart:text-2xl edusmart:font-semibold">{meta.title}</h1>
      <p className="edusmart:mb-8 edusmart:mt-3 edusmart:text-muted-foreground">{meta.sub}</p>
      <div className="edusmart:grid edusmart:items-start edusmart:gap-6 edusmart:lg:grid-cols-2">
        <section
          className={`${panel} edusmart:flex edusmart:flex-col edusmart:gap-5`}
          aria-label="Оруулах мэдээлэл"
        >
          <span className="edusmart:text-xs edusmart:tracking-widest edusmart:text-muted-foreground">
            01 / МЭДЭЭЛЛЭЭ ОРУУЛАХ
          </span>
          {kind === "voice" && (
            <>
              <button
                className={button}
                disabled={busy || recording.starting}
                onClick={() => (recording.recording ? recording.stop() : void recording.start())}
              >
                {recording.recording ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
                {recording.recording
                  ? "Бичлэг зогсоох"
                  : recording.starting
                    ? "Микрофон холбож байна…"
                    : "Ярьж тэмдэглэх (2 минут хүртэл)"}
              </button>
              {recording.recording && <p role="status">Бичлэг хийж байна…</p>}
            </>
          )}
          {kind !== "lessons" && (
            <>
              <Field
                label={
                  kind === "ocr"
                    ? "Журналын зураг (PNG, JPG, WebP · 4 MB хүртэл)"
                    : "Дууны файл (WebM, MP4, MP3, OGG, WAV · 4 MB хүртэл)"
                }
              >
                <input
                  className={field}
                  type="file"
                  disabled={busy || recording.recording}
                  accept={
                    kind === "ocr"
                      ? "image/png,image/jpeg,image/webp"
                      : "audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav"
                  }
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError("");
                  }}
                />
              </Field>
              {file && (
                <p className="edusmart:text-xs edusmart:text-muted-foreground">
                  Сонгосон: {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
              {kind === "voice" && (
                <button
                  className={button}
                  disabled={!file || busy || recording.recording}
                  onClick={() => void run(true)}
                >
                  Текст болгох
                </button>
              )}
            </>
          )}
          {kind === "lessons" && (
            <div className="edusmart:grid edusmart:grid-cols-2 edusmart:gap-4">
              <Field label="Анги">
                <select
                  className={field}
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1}>{index + 1}</option>
                  ))}
                </select>
              </Field>
              <Field label="Хугацаа (минут)">
                <input
                  className={field}
                  type="number"
                  min={10}
                  max={180}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </Field>
              <div className="edusmart:col-span-2">
                <Field label="Хичээл">
                  <input
                    className={field}
                    maxLength={120}
                    value={subject}
                    placeholder="Математик"
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}
          {kind !== "ocr" && (
            <Field label={meta.input}>
              <textarea
                className={field}
                rows={10}
                maxLength={16000}
                value={text}
                placeholder={meta.placeholder}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          )}
          <button
            className={`${button} edusmart:bg-primary edusmart:text-primary-foreground`}
            disabled={
              busy ||
              recording.recording ||
              (kind === "ocr" ? !file : !text.trim()) ||
              (kind === "lessons" && (!subject.trim() || duration < 10 || duration > 180))
            }
            onClick={() => void run()}
          >
            <IconSparkles size={18} />
            {busy
              ? "Боловсруулж байна…"
              : kind === "ocr"
                ? "Зураг таних"
                : kind === "voice"
                  ? "Тайлан үүсгэх"
                  : "Төлөвлөгөө & слайд үүсгэх"}
          </button>
          <p className="edusmart:text-xs edusmart:leading-relaxed edusmart:text-muted-foreground">
            AI-д боловсруулахаар оруулсан текст, зураг, дуу Gemini үйлчилгээнд дамжина. Үр дүнг
            ашиглахаасаа өмнө багш хянаж засна.
          </p>
        </section>
        <section
          className={`${panel} edusmart:min-w-0 edusmart:flex edusmart:flex-col edusmart:gap-5`}
          aria-label="Үр дүн"
          aria-busy={busy}
        >
          <span className="edusmart:text-xs edusmart:tracking-widest edusmart:text-muted-foreground">
            02 / ХЯНАХ & ХАДГАЛАХ
          </span>
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
            <p role="status">AI боловсруулж байна. Энэ нь нэг минут орчим үргэлжилж болно.</p>
          )}
          {!content && !busy && (
            <div className="edusmart:py-20 edusmart:text-center edusmart:text-muted-foreground">
              <IconSparkles size={34} className="edusmart:mx-auto edusmart:mb-4" />
              <p>Таны дараагийн бүтээл энд гарна.</p>
              <p className="edusmart:mt-2 edusmart:text-xs">Мэдээллээ оруулаад эхлүүлээрэй.</p>
            </div>
          )}
          {content && (
            <>
              <Field label="Хадгалах гарчиг">
                <input
                  className={field}
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              {kind === "ocr" ? (
                <>
                  <div className="edusmart:overflow-auto">
                    <table className="edusmart:w-full edusmart:text-sm">
                      <caption className="edusmart:mb-3 edusmart:text-left">
                        {rows.length} сурагч · Дундаж{" "}
                        {scored.length
                          ? (
                              scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length
                            ).toFixed(1)
                          : "—"}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Нэр</th>
                          <th scope="col">Оноо / 100</th>
                          <th scope="col">Ирц</th>
                          <th scope="col">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                aria-label={`Нэр ${index + 1}`}
                                className={field}
                                value={row.name}
                                onChange={(event) => updateRow(index, { name: event.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`Оноо ${index + 1}`}
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
                            </td>
                            <td>
                              <input
                                aria-label={`Ирц ${index + 1}`}
                                className={field}
                                value={row.attendance}
                                onChange={(event) =>
                                  updateRow(index, { attendance: event.target.value })
                                }
                              />
                            </td>
                            <td>
                              <button
                                className={button}
                                aria-label={`Мөр ${index + 1} устгах`}
                                onClick={() =>
                                  setRows((current) => current.filter((_, i) => i !== index))
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!rows.length && (
                    <p>Хүснэгт хоосон байна. Мөр нэмэх эсвэл өөр зураг оруулна уу.</p>
                  )}
                  <button
                    className={button}
                    disabled={rows.length >= 200}
                    onClick={() =>
                      setRows((current) => [...current, { name: "", score: null, attendance: "" }])
                    }
                  >
                    Мөр нэмэх
                  </button>
                </>
              ) : (
                <Field label="Засварлах агуулга">
                  <textarea
                    className={`${field} edusmart:leading-relaxed`}
                    rows={19}
                    maxLength={100000}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </Field>
              )}
              <div className="edusmart:flex edusmart:flex-wrap edusmart:gap-2">
                <button
                  className={button}
                  disabled={saving || busy || !title.trim() || !content.trim()}
                  onClick={() => void saveWork()}
                >
                  <IconDeviceFloppy size={16} />
                  {saving ? "Хадгалж байна…" : "Хадгалах"}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    kind === "ocr"
                      ? exportCsv()
                      : download(content, `edusmart-${kind}.md`, "text/markdown;charset=utf-8")
                  }
                >
                  <IconDownload size={16} />
                  {kind === "ocr" ? "Excel (CSV) татах" : "Текст татах"}
                </button>
                {slides.length > 0 && (
                  <>
                    <button
                      className={button}
                      onClick={() => {
                        setSlideIndex(0);
                        setPresenting(true);
                      }}
                    >
                      Слайд үзүүлэх
                    </button>
                    <button className={button} onClick={exportSlides}>
                      Слайд татах (HTML)
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      <section className={`${panel} edusmart:mt-8`} aria-label="Хадгалсан ажлууд">
        <h2 className="edusmart:mb-4 edusmart:text-lg edusmart:font-semibold">
          Миний хадгалсан ажлууд
        </h2>
        {history.loading && <p role="status">Ачаалж байна…</p>}
        {history.error && (
          <p role="alert">
            {history.error.message}{" "}
            <button className={button} onClick={() => void history.refetch()}>
              Дахин оролдох
            </button>
          </p>
        )}
        {!history.loading && !history.error && !history.data?.edusmartWorks.length && (
          <p className="edusmart:text-muted-foreground">Хадгалсан ажил алга.</p>
        )}
        <ul className="edusmart:grid edusmart:gap-2">
          {history.data?.edusmartWorks.map((work) => (
            <li key={work._id}>
              <button
                className={`${button} edusmart:w-full edusmart:justify-between edusmart:text-left`}
                disabled={busy}
                onClick={() => {
                  try {
                    if (kind === "ocr") setRows(parseRows(work.content));
                    setContent(work.content);
                    setTitle(work.title);
                    setError("");
                    setNotice("Хадгалсан ажлыг нээлээ.");
                  } catch {
                    setError("Хадгалсан хүснэгтийг уншиж чадсангүй.");
                  }
                }}
              >
                <span>{work.title}</span>
                <time className="edusmart:text-xs edusmart:text-muted-foreground">
                  {new Date(work.createdAt).toLocaleDateString("mn-MN")}
                </time>
              </button>
            </li>
          ))}
        </ul>
        <div className="edusmart:mt-4 edusmart:flex edusmart:gap-2">
          <button
            className={button}
            disabled={!offset || history.loading}
            onClick={() => setOffset((current) => Math.max(0, current - 10))}
          >
            Өмнөх
          </button>
          <button
            className={button}
            disabled={
              history.loading || (history.data?.edusmartWorks.length ?? 0) < 10 || offset >= 10000
            }
            onClick={() => setOffset((current) => current + 10)}
          >
            Дараах
          </button>
        </div>
      </section>
      {presenting && (
        <dialog
          ref={slidesDialog}
          onCancel={() => setPresenting(false)}
          aria-label="Хичээлийн слайд"
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
            <button autoFocus className={button} onClick={() => setPresenting(false)}>
              Хаах (Esc)
            </button>
          </div>
          <div className="edusmart:mx-auto edusmart:flex edusmart:w-full edusmart:max-w-4xl edusmart:flex-1 edusmart:items-center edusmart:overflow-auto edusmart:whitespace-pre-wrap edusmart:text-2xl edusmart:leading-relaxed">
            {slides[slideIndex]}
          </div>
          <div className="edusmart:flex edusmart:justify-center edusmart:gap-4">
            <button
              className={button}
              disabled={!slideIndex}
              onClick={() => setSlideIndex((index) => index - 1)}
            >
              ← Өмнөх
            </button>
            <button
              className={button}
              disabled={slideIndex >= slides.length - 1}
              onClick={() => setSlideIndex((index) => index + 1)}
            >
              Дараах →
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
