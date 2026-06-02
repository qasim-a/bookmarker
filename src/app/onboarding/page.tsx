import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClub } from "@/lib/club";
import { getClubByLeaderId } from "@/lib/club";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const existing = await getClubByLeaderId(session.user.id);
  if (existing) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-full max-w-sm">
        <h1 className="text-2xl font-bold">Name your book club</h1>
        <form
          action={async (formData: FormData) => {
            "use server";
            const session = await auth();
            if (!session) return;
            const name = formData.get("name") as string;
            if (!name?.trim()) return;
            await createClub(session.user.id, name.trim());
            redirect("/dashboard");
          }}
          className="space-y-3"
        >
          <input
            name="name"
            type="text"
            placeholder="e.g. Thursday Night Reads"
            className="w-full border rounded-lg px-4 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
          >
            Create Club
          </button>
        </form>
      </div>
    </div>
  );
}