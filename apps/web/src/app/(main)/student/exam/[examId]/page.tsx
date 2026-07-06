import { redirect } from "next/navigation";

const examClientBaseUrl = process.env.NEXT_PUBLIC_EXAM_CLIENT_BASE_URL ?? "http://localhost:3100";

export default async function LegacyStudentExamTakePage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.studentId
    ? `?studentId=${encodeURIComponent(resolvedSearchParams.studentId)}`
    : "";
  redirect(`${examClientBaseUrl}/exam/${resolvedParams.examId}${query}`);
}
