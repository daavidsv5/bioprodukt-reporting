import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/users';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Heslo', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;

        // Zkontroluj rate limit před jakýmkoliv DB dotazem na uživatele
        const { limited } = await isRateLimited(email);
        if (limited) return null;

        const user = await getUserByEmail(email);
        if (!user) {
          // Zaznamenat pokus i pro neexistující email (prevence user enumeration)
          await recordFailedAttempt(email);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          await recordFailedAttempt(email);
          return null;
        }

        // Úspěšné přihlášení — smazat pokusy
        await clearAttempts(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
