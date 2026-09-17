"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { retryIdea } from "@/app/actions/patent-ideas";

export function RetryButton({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await retryIdea(ideaId);
          router.refresh();
        })
      }
    >
      {isPending ? <Spinner /> : null}
      다시 시도
    </Button>
  );
}
