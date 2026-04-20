import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type SignOffPdfInput = {
  approvalEvents: Array<{
    actorUserId: string;
    createdAt: Date;
    eventType: string;
    note: string | null;
    reviewSnapshotVersion: number | null;
  }>;
  clientName: string;
  exceptionSummary: {
    activeExceptionCount: number;
    blockingExceptionCount: number;
  };
  organizationName: string;
  payRunTitle: string;
  processedSources: Array<{
    filename: string;
    kind: string;
    version: number;
  }>;
  reviewSnapshotVersion: number;
};

function wrapText(text: string, maxLength: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function buildSignOffPdf(input: SignOffPdfInput) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let cursorY = 790;

  const drawLine = (text: string, options?: { bold?: boolean; size?: number }) => {
    const size = options?.size ?? 11;
    const lines = wrapText(text, 88);

    for (const line of lines) {
      if (cursorY < 60) {
        page = pdf.addPage([595.28, 841.89]);
        cursorY = 790;
      }

      page.drawText(line, {
        color: rgb(0.11, 0.12, 0.14),
        font: options?.bold ? boldFont : font,
        size,
        x: 48,
        y: cursorY,
      });
      cursorY -= size + 6;
    }
  };

  drawLine("Tally Sign-off", { bold: true, size: 18 });
  drawLine(`${input.organizationName} · ${input.clientName}`, { size: 12 });
  drawLine(input.payRunTitle, { bold: true, size: 14 });
  drawLine(`Active reviewer snapshot: ${input.reviewSnapshotVersion}`);
  drawLine(
    `Open exceptions: ${input.exceptionSummary.activeExceptionCount} · Blocking exceptions: ${input.exceptionSummary.blockingExceptionCount}`,
  );
  cursorY -= 8;

  drawLine("Processed payroll sources", { bold: true, size: 12 });
  input.processedSources.forEach((source) => {
    drawLine(`${source.kind.replace(/_/g, " ")} · v${source.version} · ${source.filename}`);
  });

  cursorY -= 8;
  drawLine("Approval events", { bold: true, size: 12 });
  input.approvalEvents.forEach((event) => {
    drawLine(
      `${event.eventType} · snapshot ${event.reviewSnapshotVersion ?? "n/a"} · ${event.createdAt.toISOString()} · ${event.actorUserId}`,
    );

    if (event.note) {
      drawLine(`Note: ${event.note}`);
    }
  });

  return pdf.save();
}
