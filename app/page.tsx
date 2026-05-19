import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/header";
import { getLibraryData } from "@/lib/data";
import { LibraryView } from "@/components/library/library-view";
import { AnniversaryBanner } from "@/components/anniversary-banner";
import { PresenceProvider } from "@/components/presence-provider";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getLibraryData();
  if (!data.me) redirect("/login");

  return (
    <PresenceProvider userId={data.me.id} location={{ kind: "library" }}>
      <Header
        userId={data.me.id}
        displayName={data.me.display_name}
        accent={data.me.accent}
        emoji={data.me.emoji}
        partner={
          data.partner
            ? {
                userId: data.partner.id,
                displayName: data.partner.display_name,
                accent: data.partner.accent,
              }
            : null
        }
      />
      <AnniversaryBanner />
      <LibraryView
        books={data.books}
        me={data.me}
        partner={data.partner}
      />
    </PresenceProvider>
  );
}
