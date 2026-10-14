export { default } from 'next-auth/middleware';

export const config = {
  // everything except the login page, NextAuth endpoints and static assets
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
