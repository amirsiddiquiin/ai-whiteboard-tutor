import { handleNarrationRequest } from "./handler";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleNarrationRequest(request);
}
