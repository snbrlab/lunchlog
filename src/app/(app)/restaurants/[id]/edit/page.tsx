import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import EditRestaurantForm from './EditRestaurantForm';
import type { Restaurant } from '@/types/db';

export default async function EditRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!restaurant) notFound();

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isOwner = restaurant.created_by === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isOwner && !isAdmin) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10 text-center">
        <p className="text-sm text-fg">
          이 식당은 등록자 본인 또는 admin 만 수정할 수 있어요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-fg">
        식당 수정 — {restaurant.name}
      </h1>
      <EditRestaurantForm
        restaurant={restaurant as Restaurant}
        cuisineItems={await getCachedCuisineItems()}
      />
    </main>
  );
}
