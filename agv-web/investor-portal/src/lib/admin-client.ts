import { auth } from '@/lib/firebase';

type FetchInput = RequestInfo | URL;

export async function authedFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated admin user found');
  }

  const idToken = await currentUser.getIdToken(true);
  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${idToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

