import ResolverClient from "./resolver-client";

export const dynamic = "force-dynamic";

export default function Page({
  params,
}: {
  params: { attemptId: string };
}) {
  return <ResolverClient attemptId={params.attemptId} />;
}