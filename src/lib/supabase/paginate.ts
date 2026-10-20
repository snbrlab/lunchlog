// Supabase 프로젝트의 PostgREST 기본 max-rows(보통 1000) 때문에 단일 쿼리는 1000건에서
// 끊긴다. admin 목록처럼 전량이 필요한 곳에서 1000건씩 range 로 끝까지 긁어 합친다.
const PAGE = 1000;

export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await queryPage(from, from + PAGE - 1);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}
