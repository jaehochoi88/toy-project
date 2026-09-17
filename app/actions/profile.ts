"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) {
    throw new Error("Not signed in");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}
