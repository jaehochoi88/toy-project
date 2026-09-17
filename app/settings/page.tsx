import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDisplayName } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.claims.sub)
    .single();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <form action={updateDisplayName} className="w-full max-w-sm">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="displayName">Display name</FieldLabel>
            <Input
              key={profile?.display_name ?? ""}
              id="displayName"
              name="displayName"
              defaultValue={profile?.display_name ?? ""}
            />
          </Field>
          <Button type="submit">Save</Button>
        </FieldGroup>
      </form>
    </div>
  );
}
