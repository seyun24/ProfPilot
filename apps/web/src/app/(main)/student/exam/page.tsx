import { redirect } from "next/navigation";

const examClientBaseUrl = process.env.NEXT_PUBLIC_EXAM_CLIENT_BASE_URL ?? "http://localhost:3100";

export default function LegacyStudentExamEntryPage() {
  redirect(`${examClientBaseUrl}/exam`);
}
