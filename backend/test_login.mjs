import { pool } from './src/config/database.js';
import { login } from './src/modules/auth/auth.service.js';

async function test() {
  try {
    const { accessToken } = await login({ email: 'mittal@gmail.com', password: 'password' }); // Wait, password is unknown. I can't login.
    console.log(accessToken);
  } catch(e) { console.error(e); }
  process.exit(0);
}
test();
