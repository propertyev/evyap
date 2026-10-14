import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; role: 'OWNER' | 'ACCOUNTANT' | 'STAFF'; companyId: string };
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: string;
    companyId?: string;
  }
}
