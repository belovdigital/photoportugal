import { queryOne } from "@/lib/db";

let cachedHasEstimateColumn: boolean | null = null;

export async function bookingGroupSizeEstimateColumnExists(): Promise<boolean> {
  if (cachedHasEstimateColumn !== null) return cachedHasEstimateColumn;

  try {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'bookings'
           AND column_name = 'group_size_is_estimate'
       ) as exists`
    );
    if (row?.exists) cachedHasEstimateColumn = true;
    return !!row?.exists;
  } catch {
    return false;
  }
}

export async function bookingGroupSizeEstimateSelect(alias = "b"): Promise<string> {
  const safeAlias = /^[A-Za-z_][A-Za-z0-9_]*$/.test(alias) ? alias : "b";

  if (await bookingGroupSizeEstimateColumnExists()) {
    return `COALESCE(${safeAlias}.group_size_is_estimate, FALSE) as group_size_is_estimate`;
  }

  return "FALSE as group_size_is_estimate";
}
