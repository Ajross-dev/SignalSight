
import { jsPDF } from "jspdf";
import type { AnalysisReport } from "../types/analysis";

export function generateReportPdf(report: AnalysisReport) {
  const pdf = new jsPDF();

  const { analysis, coverage } = report;

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const M = 20;
  const CW = W - M * 2;
  const BOTTOM = H - 25;

  const navy: [number, number, number] = [24, 28, 38];
  const blue: [number, number, number] = [59, 130, 246];
  const gray: [number, number, number] = [100, 108, 120];
  const light: [number, number, number] = [245, 247, 250];
  const border: [number, number, number] = [225, 230, 236];

  let y = 20;

  // Convert floor-plan coordinates into readable areas.
  function getAreaName(x: number, y: number): string {
    const horizontal =
      x < 1 / 3 ? "Left" :
      x < 2 / 3 ? "Center" : "Right";

    const vertical =
      y < 1 / 3 ? "Upper" :
      y < 2 / 3 ? "Middle" : "Lower";

    if (horizontal === "Center" && vertical === "Middle") {
      return "Center area";
    }

    return `${vertical}-${horizontal.toLowerCase()} area`;
  }

  // Add a new page with a small header.
  function newPage() {
    pdf.addPage();
    y = 24;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...navy);
    pdf.text("SignalSight", M, y);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...gray);
    pdf.text("NETWORK ANALYSIS REPORT", W - M, y, {
      align: "right",
    });

    y += 10;

    pdf.setDrawColor(...border);
    pdf.line(M, y, W - M, y);

    y += 15;
  }

  function ensureSpace(height: number) {
    if (y + height > BOTTOM) {
      newPage();
    }
  }

  // Section heading.
  function heading(title: string) {
    ensureSpace(24);

    y += 5;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...navy);
    pdf.text(title, M, y);

    y += 5;

    pdf.setDrawColor(...border);
    pdf.line(M, y, W - M, y);

    y += 12;
  }

  // Paragraph with automatic text wrapping.
  function paragraph(text: string) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...gray);

    const lines: string[] = pdf.splitTextToSize(text, CW);

    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, M, y);
      y += 5.5;
    }

    y += 7;
  }

  // Recommendation or finding card.
  function itemCard(
    number: number,
    title: string,
    description: string
  ) {
    const textX = M + 22;
    const textWidth = CW - 34;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);

    const lines: string[] = pdf.splitTextToSize(
      description,
      textWidth
    );

    const cardHeight = 25 + lines.length * 5.2;

    ensureSpace(cardHeight + 8);

    const cardY = y;

    pdf.setFillColor(...light);
    pdf.setDrawColor(...border);
    pdf.roundedRect(
      M,
      cardY,
      CW,
      cardHeight,
      3,
      3,
      "FD"
    );

    // Number circle.
    pdf.setFillColor(...blue);
    pdf.circle(M + 12, cardY + 13, 6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text(String(number), M + 12, cardY + 16, {
      align: "center",
    });

    // Card title.
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...navy);
    pdf.text(title, textX, cardY + 12);

    // Card description.
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...gray);

    let textY = cardY + 22;

    for (const line of lines) {
      pdf.text(line, textX, textY);
      textY += 5.2;
    }

    y += cardHeight + 8;
  }

  // ==========================================
  // PAGE 1 - COVERAGE OVERVIEW
  // ==========================================

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, W, 50, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.setTextColor(255, 255, 255);
  pdf.text("SignalSight", M, 21);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(195, 210, 230);
  pdf.text("Wi-Fi Coverage Assessment", M, 32);

  pdf.setFontSize(9);
  pdf.text(
    `Generated: ${new Date(report.created_at).toLocaleString()}`,
    M,
    41
  );

  y = 64;

  // Coverage score.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...gray);
  pdf.text("AVERAGE SIGNAL SCORE", M, y);

  y += 17;

  pdf.setFontSize(34);
  pdf.setTextColor(...blue);
  pdf.text(`${analysis.coverage_score}/100`, M, y);

  y += 15;

  // Statistic cards.
  const stats = [
    ["Measurements", String(coverage.measurement_count)],
    [
      "Average Signal",
      coverage.average_signal === null
        ? "N/A"
        : `${coverage.average_signal}%`,
    ],
    [
      "Strong Readings",
      String(coverage.strong_measurement_count),
    ],
    [
      "Weak Readings",
      String(coverage.weak_measurement_count),
    ],
  ];

  const statWidth = CW / stats.length;

  stats.forEach(([label, value], index) => {
    const x = M + index * statWidth;

    pdf.setFillColor(...light);
    pdf.roundedRect(
      x + 1,
      y,
      statWidth - 3,
      27,
      3,
      3,
      "F"
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...navy);
    pdf.text(value, x + 5, y + 11);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...gray);
    pdf.text(label, x + 5, y + 20);
  });

  y += 37;

  // ==========================================
  // SIGNAL STRENGTH CHART
  // ==========================================

  heading("Measured Signal Strength");

  const measurements = coverage.measurements.slice(0, 12);

  if (measurements.length === 0) {
    paragraph("No measurements were recorded.");
  } else {
    measurements.forEach((measurement, index) => {
      ensureSpace(11);

      const signal = Math.max(
        0,
        Math.min(100, measurement.signal)
      );

      const barX = M + 28;
      const barW = CW - 58;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...navy);

      pdf.text(`Point ${index + 1}`, M, y + 3);

      // Background bar.
      pdf.setFillColor(230, 235, 242);
      pdf.roundedRect(barX, y - 2, barW, 6, 2, 2, "F");

      // Signal strength bar.
      if (signal > 0) {
        if (signal < 40) {
          pdf.setFillColor(239, 68, 68);
        } else if (signal < 70) {
          pdf.setFillColor(234, 179, 8);
        } else {
          pdf.setFillColor(34, 197, 94);
        }

        pdf.roundedRect(
          barX,
          y - 2,
          (barW * signal) / 100,
          6,
          2,
          2,
          "F"
        );
      }

      pdf.setTextColor(...navy);
      pdf.text(
        `${measurement.signal}%`,
        W - M,
        y + 3,
        { align: "right" }
      );

      y += 10;
    });

    if (coverage.measurements.length > 12) {
      paragraph(
        `Showing the first 12 of ${coverage.measurements.length} measurements.`
      );
    }
  }

  // ==========================================
  // PAGE 2 - NETWORK FINDINGS
  // ==========================================

  newPage();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(...navy);
  pdf.text("Your Network Findings", M, y);

  y += 12;

  paragraph(
    "This report identifies areas with lower measured Wi-Fi signal " +
    "and recommends practical steps to improve coverage."
  );

  // ==========================================
  // AREAS TO INVESTIGATE
  // ==========================================

  heading("Where Is Your Wi-Fi Weakest?");

  const issues = [...analysis.dead_zones]
    .sort((a, b) => a.signal - b.signal)
    .slice(0, 3);

  if (issues.length === 0) {
    paragraph(
      "No specific coverage concerns were identified from the measurements."
    );
  } else {
    issues.forEach((zone, index) => {
      const area = getAreaName(zone.x, zone.y);

      itemCard(
        index + 1,
        `${area} - ${zone.signal}% signal`,
        index === 0
          ? "This is one of the lowest recorded signal areas. " +
            "Check for slow speeds or unstable connections here first."
          : "Signal is lower in this area. Check whether devices " +
            "experience connection problems before making changes."
      );
    });
  }

  // ==========================================
  // RECOMMENDED NEXT STEPS
  // ==========================================

  heading("What Should You Do Next?");

  const weakest = [...coverage.measurements]
    .sort((a, b) => a.signal - b.signal)[0];

  if (weakest) {
    itemCard(
      1,
      "Check the weakest measured area",
      `Test Wi-Fi performance in the ${getAreaName(
        weakest.x,
        weakest.y
      ).toLowerCase()}, where the lowest recorded signal was ` +
      `${weakest.signal}%.`
    );
  } else {
    itemCard(
      1,
      "Take initial measurements",
      "Record Wi-Fi signal readings in several areas of the floor."
    );
  }

  itemCard(
    2,
    "Review your router placement",
    "Find where your current router or access points are installed. " +
    "If testing confirms poor coverage, consider improving " +
    "coverage near the affected area."
  );

  itemCard(
    3,
    "Test more locations",
    "Measure additional rooms, corners, and untested areas " +
    "before purchasing new equipment."
  );

  // ==========================================
  // LIMITATIONS
  // ==========================================

  heading("What We Still Don't Know");

  paragraph(
    `This assessment is based on ${coverage.measurement_count} ` +
    "recorded measurements. Areas that were not tested may have " +
    "different Wi-Fi performance. The results do not confirm " +
    "the best exact router location or whether additional " +
    "equipment is necessary."
  );

  paragraph(
    "Floor-plan area names are approximate and are based " +
    "on the orientation of the map displayed in SignalSight."
  );

  // ==========================================
  // FOOTERS
  // ==========================================

  const totalPages = pdf.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);

    pdf.setDrawColor(...border);
    pdf.line(M, H - 17, W - M, H - 17);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...gray);

    pdf.text(
      "SignalSight | Preliminary Wi-Fi coverage assessment",
      M,
      H - 11
    );

    pdf.text(
      `Page ${page} of ${totalPages}`,
      W - M,
      H - 11,
      { align: "right" }
    );
  }

  pdf.save(
    `SignalSight-Report-${report.id.slice(0, 8)}.pdf`
  );
}
