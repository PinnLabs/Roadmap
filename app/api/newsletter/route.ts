import { handleNewsletterSubscribe } from "@/lib/newsletter/http";

export function POST(request: Request): Promise<Response> {
  return handleNewsletterSubscribe(request, { env: process.env });
}