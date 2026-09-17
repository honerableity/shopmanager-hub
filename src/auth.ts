import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Auth.js (NextAuth v5) config.
 *
 * Login pakai Discord OAuth2 saja untuk sekarang -- provider lain (mis.
 * email/magic-link) gampang ditambahkan belakangan begitu ada domain +
 * email pengirim sendiri, tanpa perlu bongkar setup ini.
 *
 * discordId & avatar Discord disisipkan ke session lewat callback jwt/session
 * di bawah supaya halaman lain (dashboard, toko, admin) bisa langsung pakai
 * `session.user.discordId` tanpa query ulang ke Discord API.
 *
 * TODO (langkah berikutnya, belum dikerjakan):
 * - Simpan/upsert user ke tabel `users` Supabase saat pertama kali login
 *   (lewat callback `signIn` atau `jwt`), termasuk cek status blacklist.
 * - Tambahkan field `role` (user/admin) & `is_blacklisted` ke session.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // account & profile cuma tersedia sekali, tepat setelah login pertama
      if (account && profile) {
        token.discordId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.discordId && session.user) {
        session.user.discordId = token.discordId as string;
      }
      return session;
    },
  },
});
