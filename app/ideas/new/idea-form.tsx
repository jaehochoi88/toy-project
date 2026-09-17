"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { submitIdea } from "@/app/actions/patent-ideas";
import type { MissingItem } from "@/lib/gemini/schemas";

type Step = "input" | "clarify";

export function IdeaForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [body, setBody] = useState("");
  const [questions, setQuestions] = useState<MissingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnswerChange(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function submit(withClarifications: boolean) {
    setError(null);
    startTransition(async () => {
      const clarifications = withClarifications
        ? {
            problem: answers.problem,
            mechanism: answers.mechanism,
            differentiation: answers.differentiation,
          }
        : undefined;

      const result = await submitIdea({ body, clarifications });

      if (result.status === "needs_clarification") {
        setQuestions(result.questions);
        setStep("clarify");
        return;
      }
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.push(`/ideas/${result.ideaId}`);
    });
  }

  if (isPending) {
    return (
      <Card className="items-center gap-3 py-16 text-center">
        <Spinner className="size-6" />
        <p className="text-sm font-medium">아이디어를 분석하고 있습니다</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          국내 공개 특허를 검색하고 겹침을 판단하는 데 30초 안팎이 걸립니다. 이 화면을
          벗어나지 말고 기다려 주세요.
        </p>
      </Card>
    );
  }

  if (step === "clarify") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-xl font-semibold">아이디어 보완</h1>
          <p className="text-xs text-muted-foreground">
            분석에 필요한 내용이 비어 있습니다. 채우면 바로 분석으로 넘어갑니다.
          </p>
        </div>
        <Alert>
          <AlertTitle>이 항목들이 점수를 가릅니다</AlertTitle>
          <AlertDescription>
            구체성과 진보성은 여기에 적은 내용으로 판단합니다. 비워둬도 분석은 진행되지만
            그만큼 점수가 내려갑니다.
          </AlertDescription>
        </Alert>
        <Card className="p-5">
          <FieldGroup>
            {questions.map((q, i) => (
              <div key={q.id} className="flex flex-col gap-2">
                {i > 0 && <Separator className="my-1" />}
                <Field>
                  <FieldLabel htmlFor={q.id}>{q.label}</FieldLabel>
                  <FieldDescription>{q.description}</FieldDescription>
                  <Textarea
                    id={q.id}
                    rows={3}
                    placeholder={q.placeholder}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  />
                </Field>
              </div>
            ))}
          </FieldGroup>
        </Card>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button onClick={() => submit(true)}>분석 계속</Button>
          <Button variant="ghost" onClick={() => submit(true)}>
            비워두고 분석
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/ideas")}>
          내 아이디어
        </Button>
      </div>
      <div>
        <h1 className="font-heading text-xl font-semibold">새 아이디어</h1>
        <p className="text-xs text-muted-foreground">
          떠오른 대로 적어도 됩니다. 부족한 부분은 분석 전에 따로 물어봅니다.
        </p>
      </div>
      <Card className="p-5">
        <Field>
          <FieldLabel htmlFor="idea-body">아이디어</FieldLabel>
          <FieldDescription>
            무엇을 해결하려는 것인지, 어떻게 동작하는지 아는 만큼 적으세요.
          </FieldDescription>
          <Textarea
            id="idea-body"
            rows={9}
            placeholder="예) 세탁기 탈수 중에 배수 필터가 막히면 지금은 에러 코드가 뜨고 나서야 알게 된다. 모터에 걸리는 부하 패턴이 평소와 달라지는 것을 보고 막히기 전에 미리 알려주면 좋겠다."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Button disabled={body.trim().length === 0} onClick={() => submit(false)}>
          분석 시작
        </Button>
        <span className="text-xs text-muted-foreground">분석에는 30초 안팎이 걸립니다.</span>
      </div>
    </div>
  );
}
