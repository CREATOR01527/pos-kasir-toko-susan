export async function logActivity(supabase, { userId, action, entity, entityId, details }) {
  try {
    await supabase.from("activity_log").insert({
      user_id: userId,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      details: details || null,
    });
  } catch (e) {
    // logging tidak boleh menghentikan alur utama
    console.error("Gagal mencatat log aktivitas:", e);
  }
}
