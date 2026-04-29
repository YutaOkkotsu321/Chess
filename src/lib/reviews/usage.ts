import { createClient } from "@/lib/supabase/server";

export const FREE_DAILY_REVIEW_LIMIT = 5;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getReviewsUsedToday(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("review_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("day_key", todayUtc());
  return count ?? 0;
}

export async function hasReviewedGameToday(
  userId: string,
  gameId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_events")
    .select("user_id")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .eq("day_key", todayUtc())
    .maybeSingle();
  return !!data;
}

export async function recordReviewEvent(
  userId: string,
  gameId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("review_events")
    .upsert(
      { user_id: userId, game_id: gameId },
      { onConflict: "user_id,game_id,day_key", ignoreDuplicates: true }
    );
}

export type ReviewQuotaCheck =
  | { allowed: true; isPro: boolean; usedToday: number; limit: number | null }
  | { allowed: false; usedToday: number; limit: number };

/**
 * Decides whether the current user can open a review for a given game,
 * and (when allowed) records the view so it counts against the daily cap.
 *
 * Pro users always pass through. Free users get FREE_DAILY_REVIEW_LIMIT
 * distinct game reviews per UTC day; revisiting the same game on the same
 * day is free.
 */
export async function checkAndRecordReview({
  userId,
  gameId,
  isPro,
}: {
  userId: string;
  gameId: string;
  isPro: boolean;
}): Promise<ReviewQuotaCheck> {
  if (isPro) {
    await recordReviewEvent(userId, gameId);
    const usedToday = await getReviewsUsedToday(userId);
    return { allowed: true, isPro: true, usedToday, limit: null };
  }

  const alreadyReviewed = await hasReviewedGameToday(userId, gameId);
  if (alreadyReviewed) {
    const usedToday = await getReviewsUsedToday(userId);
    return {
      allowed: true,
      isPro: false,
      usedToday,
      limit: FREE_DAILY_REVIEW_LIMIT,
    };
  }

  const usedToday = await getReviewsUsedToday(userId);
  if (usedToday >= FREE_DAILY_REVIEW_LIMIT) {
    return { allowed: false, usedToday, limit: FREE_DAILY_REVIEW_LIMIT };
  }

  await recordReviewEvent(userId, gameId);
  return {
    allowed: true,
    isPro: false,
    usedToday: usedToday + 1,
    limit: FREE_DAILY_REVIEW_LIMIT,
  };
}
