"use client";

import { useState } from "react";

// Admin-only helper used alongside /keystatic (BLOB-002). Uploads a file to
// /api/team-photo, which enforces editor authorization and file constraints
// before calling Blob's put(), then surfaces the URL for the editor to paste
// into the team singleton's photoUrl field.
export function TeamPhotoUploader() {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus("uploading");
    setError(null);
    setUrl(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/team-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Upload failed.");
        return;
      }
      setStatus("done");
      setUrl(data.url);
    } catch {
      setStatus("error");
      setError("Upload failed — network error.");
    }
  }

  return (
    <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm">
      <label className="label-code block text-slate-600">
        Admin: upload a team photo
      </label>
      <input
        type="file"
        accept="image/*"
        className="mt-2 text-slate-700"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {status === "uploading" && <p className="mt-2 text-slate-500">Uploading…</p>}
      {status === "error" && error && <p className="mt-2 text-red-700">{error}</p>}
      {status === "done" && url && (
        <p className="mt-2 break-all text-slate-700">
          Uploaded. Paste this URL into the team singleton&apos;s Photo URL field:{" "}
          <code className="font-mono">{url}</code>
        </p>
      )}
    </div>
  );
}
