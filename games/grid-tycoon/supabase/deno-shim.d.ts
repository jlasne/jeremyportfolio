// Just enough of the Deno namespace to typecheck the edge function with tsc (tsconfig.check.json).
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown
  const env: { get(name: string): string | undefined }
}
