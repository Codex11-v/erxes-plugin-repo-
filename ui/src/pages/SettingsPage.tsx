import { useQuery } from "@apollo/client";
import { Link } from "react-router";
import { STATUS_QUERY } from "../graphql";

export function SettingsPage() {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.edusmartStatus;
  return (
    <div className="edusmart:mx-auto edusmart:max-w-3xl edusmart:p-8">
      <Link to="/edusmart" className="edusmart:text-muted-foreground">
        ← AI төв
      </Link>
      <h1 className="edusmart:my-6 edusmart:text-2xl edusmart:font-semibold">Тохиргоо & холболт</h1>
      {loading && <p role="status">Холболт шалгаж байна…</p>}
      {error && (
        <p role="alert">
          {error.message} <button onClick={() => void refetch()}>Дахин оролдох</button>
        </p>
      )}
      {!loading && !error && !status && <p>Холболтын мэдээлэл алга.</p>}
      {status && (
        <dl className="edusmart:grid edusmart:grid-cols-2 edusmart:gap-4 edusmart:rounded-xl edusmart:border edusmart:border-border edusmart:p-6">
          <dt>EduSmart</dt>
          <dd>Холбогдсон · v{status.version}</dd>
          <dt>Байгууллага</dt>
          <dd>{status.subdomain || "—"}</dd>
          <dt>Багш</dt>
          <dd>{status.userEmail || status.userId || "Нэвтрээгүй"}</dd>
          <dt>AI үйлчилгээ</dt>
          <dd>{status.aiReady ? "Тохируулагдсан" : "Тохируулаагүй · Админтай холбогдоно уу"}</dd>
        </dl>
      )}
      <p className="edusmart:mt-6 edusmart:text-sm edusmart:leading-relaxed edusmart:text-muted-foreground">
        AI хэрэгслүүдийг ашиглах болон ажлаа хадгалах эрхийг байгууллагын админ олгоно. Таны
        хадгалсан ажил зөвхөн өөрийн бүртгэлд харагдана. Оруулсан текст, зураг, дуу AI
        боловсруулалтад Gemini үйлчилгээнд дамжина. AI түлхүүрийг серверт хадгална.
      </p>
    </div>
  );
}
