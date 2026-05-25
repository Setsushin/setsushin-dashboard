import { getUserEmail, json } from '../_lib/auth';
import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const email = getUserEmail(request, env);
  const local = !request.headers.get('Cf-Access-Jwt-Assertion');
  return json({ email, local });
};
