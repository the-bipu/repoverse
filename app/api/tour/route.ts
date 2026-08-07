import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface TourRequestBody {
  owner: string;
  repo: string;
  description: string | null;
  topFolders: { name: string; kind: "folder" | "file"; fileCount: number }[];
  stats: { totalFiles: number; totalFolders: number };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI tour isn't configured. Set GEMINI_API_KEY in your .env.local (see .env.local.example) and restart the dev server.",
      },
      { status: 501 }
    );
  }

  let body: TourRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { owner, repo, description, topFolders, stats } = body;
  if (!owner || !repo || !Array.isArray(topFolders)) {
    return NextResponse.json({ error: "Missing repo context." }, { status: 400 });
  }

  const folderList = topFolders
    .map((f) => `- ${f.name} (${f.kind}, ${f.fileCount} file${f.fileCount === 1 ? "" : "s"})`)
    .join("\n");

  const prompt = `You are a museum guide walking a developer through the structure of a GitHub repository, based only on its top-level folder/file names and file counts — you have not read any source code.

Repository: ${owner}/${repo}
Description: ${description ?? "(none provided)"}
Totals: ${stats.totalFiles} files across ${stats.totalFolders} folders

Top-level items:
${folderList}

Write a short walkthrough (5-8 short paragraphs, plain text, no markdown headers or bullet lists) in a warm, guide-like voice. Cover:
1. A one-sentence guess at what kind of project this is, based on the folder names and description.
2. A suggested starting point for a new contributor, and why.
3. A likely purpose for 3-5 of the most interesting top-level folders (best guess from naming conventions — say "likely" or "probably" rather than stating it as fact).
4. One honest caveat that this is inferred from folder names and file counts only, not from reading the actual code.

Keep it concise — this is a quick orientation, not a full report.`;

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Gemini API error (${res.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const tour: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!tour) {
      const blockReason = data?.promptFeedback?.blockReason;
      return NextResponse.json(
        { error: blockReason ? `Gemini declined to respond (${blockReason}).` : "No response generated — try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ tour });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tour generation failed." },
      { status: 500 }
    );
  }
}