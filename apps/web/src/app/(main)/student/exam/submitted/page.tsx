import { redirect } from "next/navigation";

const examClientBaseUrl = process.env.NEXT_PUBLIC_EXAM_CLIENT_BASE_URL ?? "http://localhost:3100";

export default async function LegacyStudentExamSubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ submissionId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.submissionId
    ? `?submissionId=${encodeURIComponent(resolvedSearchParams.submissionId)}`
    : "";
  redirect(`${examClientBaseUrl}/exam/submitted${query}`);
}
