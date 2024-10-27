"use client";
import { useSearchParams } from "next/navigation";
import { openrouterCode } from "@/components/openrouter";
import { useEffect } from "react";
import { Suspense } from "react";

export default function Page() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  useEffect(() => {
    fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      body: JSON.stringify({
        code,
      }),
    })
      .then((resp) => resp.json())
      .then((json) => {
        openrouterCode.value = json.key;
        setTimeout(() => {
          window.close();
        }, 3000);
      });
  }, [code]);
  return (
    <Suspense>
      <div>Code received, closing window...</div>
    </Suspense>
  );
}
