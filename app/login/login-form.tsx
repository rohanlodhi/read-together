"use client";

import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { sendMagicLink, type LoginState } from "./actions";
import { PixelIcon } from "@/components/pixel-icon";

const initial: LoginState = { status: "idle" };

const ERRORS: Record<string, string> = {
  "not-allowed": "Sorry, this little library is invite-only",
  verify: "That link expired. Try again?",
  missing: "Something was missing from that link.",
  exchange: "Couldn't sign you in. Try sending a new link.",
};

export default function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get("error");
  const [state, formAction, pending] = useActionState(sendMagicLink, initial);

  useEffect(() => {
    if (urlError && ERRORS[urlError]) toast.error(ERRORS[urlError]);
  }, [urlError]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        className="card-soft w-full max-w-md p-8 sm:p-10"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-1 text-ink">
            <PixelIcon name="open-book" size={60} />
            <PixelIcon
              name="heart"
              size={40}
              className="text-rose-deep -ml-1"
            />
          </div>

          <h1
            className="font-display text-5xl text-ink leading-none tracking-tight mt-2"
            style={{ fontWeight: 700 }}
          >
            read-together
          </h1>
          <p className="text-ink-soft text-[15px] font-medium">
            a tiny shared library, just for us
          </p>
        </div>

        {state.status === "sent" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="mt-8 card-soft-quiet p-6 text-center"
            style={{ background: "var(--color-sage-soft)" }}
          >
            <PixelIcon
              name="envelope-with-arrow"
              size={42}
              className="mb-2 text-ink"
            />
            <p className="font-bold text-lg">check your inbox</p>
            <p className="text-sm text-ink-soft mt-1">
              we sent a magic link to
              <br />
              <span className="font-bold text-ink">{state.email}</span>
            </p>
          </motion.div>
        ) : (
          <form action={formAction} className="mt-8 flex flex-col gap-3">
            <label className="text-sm font-bold text-ink-soft pl-1">
              your email
            </label>
            <div className="relative">
              <PixelIcon
                name="envelope"
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-soft"
              />
              <input
                name="email"
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full rounded-xl bg-cream-deep/40 border-2 border-ink-soft pl-10 pr-4 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-peach-deep focus:bg-paper transition font-medium"
                style={{ boxShadow: "3px 3px 0 0 var(--color-ink-soft)" }}
              />
            </div>

            {state.status === "error" && (
              <p className="text-rose-deep text-sm px-2 flex items-center gap-1.5 font-semibold">
                <PixelIcon name="alert" size={16} />
                {state.message}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={pending}
              whileTap={{ scale: 0.97 }}
              className="btn-bouncy mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PixelIcon name="love-letter" size={18} />
              {pending ? "sending…" : "send the magic link"}
            </motion.button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-ink-faint flex items-center justify-center gap-1.5 font-semibold">
          we&apos;ll send a one-time sign-in link to your email
        </p>
      </motion.div>
    </main>
  );
}
