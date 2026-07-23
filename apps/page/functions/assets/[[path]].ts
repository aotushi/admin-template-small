type AssetRequestContext = {
  next: () => Promise<Response>;
};

function isSpaFallback(response: Response) {
  return response.headers.get("content-type")?.startsWith("text/html") ?? false;
}

function createNotFoundResponse() {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
    status: 404,
  });
}

export async function onRequest(context: AssetRequestContext) {
  const response = await context.next();

  if (response.status === 404 || isSpaFallback(response)) {
    return createNotFoundResponse();
  }

  return response;
}
