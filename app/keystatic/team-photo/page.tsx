import Link from "next/link";
import { TeamPhotoUploader } from "@/components/site/team-photo-uploader";

// Deliberately placed under /keystatic (excluded from the locale-prefix
// middleware, see middleware.ts) rather than on the public About page —
// the About page is part of the login-free public archive, and a file
// upload control has no place there. This route has no auth of its own,
// matching /keystatic's own local-storage dev mode; see the "Remaining
// Risks" note in the implementation report about production access
// control before this is exposed on a real deployment.
export default function TeamPhotoUploadPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-xl font-bold text-slate-900">Team photo upload</h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload a photo, then paste the returned URL into the team
        singleton&apos;s Photo URL field in{" "}
        <Link href="/keystatic" className="underline">
          /keystatic
        </Link>
        .
      </p>
      <TeamPhotoUploader />
    </div>
  );
}
