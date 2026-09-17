import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IdeaForm } from "@/app/ideas/new/idea-form";

export default async function NewIdeaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <IdeaForm />
    </div>
  );
}
