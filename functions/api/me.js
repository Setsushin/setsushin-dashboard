import { getUserEmail, json } from '../_lib/auth.js';

export const onRequestGet = ({ request, env }) => {
  const email = getUserEmail(request, env);
  const local = !request.headers.get('Cf-Access-Jwt-Assertion');
  return json({ email, local });
};
