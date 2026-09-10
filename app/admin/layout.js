import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "admin") redirect("/kasir");

  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();

  return (
    <AdminShell profile={profile} settings={settings}>
      {children}
    </AdminShell>
  );
}
