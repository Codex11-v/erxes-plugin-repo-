import { useQuery } from "@apollo/client";
import { Link } from "react-router";
import { STATUS_QUERY } from "../graphql";

export function SettingsPage() {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.edusmartStatus;
  return (
    <div className="edusmart:mx-auto edusmart:max-w-3xl edusmart:p-8">
      <Link to="/edusmart" className="edusmart:text-muted-foreground">
        ← AI Home
      </Link>
      <h1 className="edusmart:my-6 edusmart:text-2xl edusmart:font-semibold">
        Settings & connection
      </h1>
      {loading && <p role="status">Checking connection…</p>}
      {error && (
        <p role="alert">
          {error.message} <button onClick={() => void refetch()}>Try again</button>
        </p>
      )}
      {!loading && !error && !status && <p>No connection details available.</p>}
      {status && (
        <dl className="edusmart:grid edusmart:grid-cols-2 edusmart:gap-4 edusmart:rounded-xl edusmart:border edusmart:border-border edusmart:p-6">
          <dt>EduSmart</dt>
          <dd>Connected · v{status.version}</dd>
          <dt>Organization</dt>
          <dd>{status.subdomain || "—"}</dd>
          <dt>Teacher</dt>
          <dd>{status.userEmail || status.userId || "Not signed in"}</dd>
          <dt>AI service</dt>
          <dd>{status.aiReady ? "Configured" : "Not configured · Contact your administrator"}</dd>
        </dl>
      )}
      <p className="edusmart:mt-6 edusmart:text-sm edusmart:leading-relaxed edusmart:text-muted-foreground">
        Your organization administrator controls access to AI tools and saved work. EduSmart stores
        saved work in its organization database and shows each item only to its author. Text, images,
        and audio are sent to Gemini for processing. The AI key is stored on the server.
      </p>
    </div>
  );
}
