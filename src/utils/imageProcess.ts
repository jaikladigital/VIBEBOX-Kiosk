import { AdminSettings } from "../types";

function drawImageProp(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX = 0.5,
  offsetY = 0.5,
) {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const r = Math.min(w / iw, h / ih);
  let nw = iw * r;
  let nh = ih * r;
  let ar = 1;

  if (nw < w) ar = w / nw;
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
  nw *= ar;
  nh *= ar;

  let cw = iw / (nw / w);
  let ch = ih / (nh / h);
  let cx = (iw - cw) * offsetX;
  let cy = (ih - ch) * offsetY;

  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;
  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
}

function loadImageSafe(url: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    if (!url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = url;
  });
}

export const generatePhotoPrint = async (
  photos: string[],
  frameUrl: string,
  settings: AdminSettings,
  score: number | null,
  playerName: string,
  hideScoreFooter = false,
): Promise<string> => {
  const isLandscapeLayout = [
    "4X6_LANDSCAPE_SINGLE",
    "4X6_TRIPLE",
    "4X6_3_PHOTO_A",
    "4X6_3_PHOTO_B",
    "4X6_4_PHOTO",
    "4X6_2_PHOTO_A",
    "4X6_2_PHOTO_B",
  ].includes(settings.printLayout);

  const canvas = document.createElement("canvas");
  canvas.width = isLandscapeLayout ? 1800 : 1200;
  canvas.height = isLandscapeLayout ? 1200 : 1800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = settings.photoPrintBackgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const isHalfStrips =
    settings.printLayout === "2X6_3_PHOTO" ||
    settings.printLayout === "2X6_4_PHOTO" ||
    (settings.printLayout as string) === "HALF_STRIPS";
  const photoCount = Math.max(1, photos.length);

  // Load frame safely with timeout
  const frameImage = await loadImageSafe(frameUrl, 6000);

  if (settings.printFrameLayer === "BACK" && frameImage) {
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  }

  const drawPhoto = (
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    drawImageProp(ctx, img, x, y, w, h, 0.5, 0.5);
    ctx.restore();

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
  };

  if (photos.length > 0) {
    const m = 60;
    let topM = isLandscapeLayout ? 150 : 250;
    let botM = isLandscapeLayout ? 250 : 450;
    const gap = 30;
    const cw = canvas.width;
    const ch = canvas.height;

    type Box = { x: number; y: number; w: number; h: number; pi: number };
    const boxes: Box[] = [];

    switch (settings.printLayout) {
      case "2X6_3_PHOTO":
      case ("HALF_STRIPS" as any): {
        topM = 220;
        botM = 400;
        const stripW = 600;
        const marginX = 40;
        const cellW = stripW - marginX * 2;
        const cellH = (ch - topM - botM - gap * 2) / 3;
        for (let c = 0; c < 2; c++) {
          for (let r = 0; r < 3; r++) {
            boxes.push({
              x: c * stripW + marginX,
              y: topM + r * (cellH + gap),
              w: cellW,
              h: cellH,
              pi: r,
            });
          }
        }
        break;
      }
      case "2X6_4_PHOTO": {
        topM = 220;
        botM = 400;
        const stripW = 600;
        const marginX = 40;
        const cellW = stripW - marginX * 2;
        const cellH = (ch - topM - botM - gap * 3) / 4;
        for (let c = 0; c < 2; c++) {
          for (let r = 0; r < 4; r++) {
            boxes.push({
              x: c * stripW + marginX,
              y: topM + r * (cellH + gap),
              w: cellW,
              h: cellH,
              pi: r,
            });
          }
        }
        break;
      }
      case "4X6_6_PHOTO": {
        const cellW = (cw - m * 2 - gap) / 2;
        const cellH = (ch - topM - botM - gap * 2) / 3;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 2; c++) {
            boxes.push({
              x: m + c * (cellW + gap),
              y: topM + r * (cellH + gap),
              w: cellW,
              h: cellH,
              pi: r * 2 + c,
            });
          }
        }
        break;
      }
      case "4X6_PORTRAIT_SINGLE":
      case "4X6_LANDSCAPE_SINGLE": {
        boxes.push({ x: m, y: topM, w: cw - m * 2, h: ch - topM - botM, pi: 0 });
        break;
      }
      case "4X6_TRIPLE": {
        const cellW = (cw - m * 2 - gap * 2) / 3;
        const cellH = ch - topM - botM;
        for (let c = 0; c < 3; c++) {
          boxes.push({
            x: m + c * (cellW + gap),
            y: topM,
            w: cellW,
            h: cellH,
            pi: c,
          });
        }
        break;
      }
      case "4X6_3_PHOTO_A": {
        const cellW = (cw - m * 2 - gap) / 2;
        const cellH = (ch - topM - botM - gap) / 2;
        const fullH = ch - topM - botM;
        boxes.push({ x: m, y: topM, w: cellW, h: fullH, pi: 0 });
        boxes.push({ x: m + cellW + gap, y: topM, w: cellW, h: cellH, pi: 1 });
        boxes.push({
          x: m + cellW + gap,
          y: topM + cellH + gap,
          w: cellW,
          h: cellH,
          pi: 2,
        });
        break;
      }
      case "4X6_3_PHOTO_B": {
        const cellW = (cw - m * 2 - gap) / 2;
        const cellH = (ch - topM - botM - gap) / 2;
        const fullW = cw - m * 2;
        boxes.push({ x: m, y: topM, w: cellW, h: cellH, pi: 0 });
        boxes.push({ x: m + cellW + gap, y: topM, w: cellW, h: cellH, pi: 1 });
        boxes.push({ x: m, y: topM + cellH + gap, w: fullW, h: cellH, pi: 2 });
        break;
      }
      case "4X6_4_PHOTO": {
        const topH = (ch - topM - botM - gap) * 0.6;
        const botH = (ch - topM - botM - gap) * 0.4;
        boxes.push({ x: m, y: topM, w: cw - m * 2, h: topH, pi: 0 });
        const cellW = (cw - m * 2 - gap * 2) / 3;
        for (let c = 0; c < 3; c++) {
          boxes.push({
            x: m + c * (cellW + gap),
            y: topM + topH + gap,
            w: cellW,
            h: botH,
            pi: 1 + c,
          });
        }
        break;
      }
      case "4X6_2_PHOTO_A": {
        const cellW = (cw - m * 2 - gap) / 2;
        const cellH = (ch - topM - botM - gap) / 2;
        boxes.push({ x: m, y: topM, w: cellW, h: cellH, pi: 0 });
        boxes.push({ x: m, y: topM + cellH + gap, w: cellW, h: cellH, pi: 1 });
        break;
      }
      case "4X6_2_PHOTO_B": {
        const cellW = (cw - m * 2 - gap) / 2;
        const cellH = (ch - topM - botM - gap) / 2;
        boxes.push({ x: m, y: topM, w: cellW, h: cellH, pi: 0 });
        boxes.push({ x: m + cellW + gap, y: topM, w: cellW, h: cellH, pi: 1 });
        break;
      }
      default: {
        const cellW = cw - m * 2;
        const cellH =
          (ch - topM - botM - gap * (photoCount - 1)) / photoCount;
        for (let r = 0; r < photoCount; r++) {
          boxes.push({
            x: m,
            y: topM + r * (cellH + gap),
            w: cellW,
            h: cellH,
            pi: r,
          });
        }
      }
    }

    const loadedImgs = await Promise.all(
      photos.map((photoUrl) => loadImageSafe(photoUrl, 5000)),
    );

    boxes.forEach((box) => {
      const img = loadedImgs[box.pi % photoCount];
      if (img) {
        drawPhoto(img, box.x, box.y, box.w, box.h, 16);
      }
    });
  }

  // Front Frame Layer
  if (settings.printFrameLayer !== "BACK" && frameImage) {
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = settings.primaryColor || "#000000";

  const drawMultiLineText = (
    text: string,
    x: number,
    y: number,
    baseFont: number,
    lineHeightOffset: number,
  ) => {
    const words = text.includes(" ") ? text.split(" ") : [text];
    const maxWordLen = Math.max(...words.map((w) => w.length));

    let fontSize = baseFont;
    if (maxWordLen > 12) fontSize = Math.floor(baseFont * 0.6);
    else if (maxWordLen > 8) fontSize = Math.floor(baseFont * 0.8);

    ctx.font = `bold ${fontSize}px Outfit, Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = "center";

    const adjustedLineHeight = lineHeightOffset * (fontSize / baseFont);
    let currentY = y - ((words.length - 1) * adjustedLineHeight) / 2;
    words.forEach((word) => {
      ctx.fillText(word.toUpperCase(), x, currentY);
      currentY += adjustedLineHeight;
    });
  };

  const eventDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (isHalfStrips) {
    drawMultiLineText(settings.brandName, 300, 120, 45, 50);
    drawMultiLineText(settings.brandName, 900, 120, 45, 50);

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 28px JetBrains Mono, monospace";
    if (hideScoreFooter || score === null) {
      const caption = playerName ? `${playerName} · ${eventDate}` : eventDate;
      ctx.fillText(caption, 300, canvas.height - 305);
      ctx.fillText(caption, 900, canvas.height - 305);
    } else {
      ctx.fillText(`PLAYER: ${playerName}`, 300, canvas.height - 330);
      ctx.fillText(`SCORE: ${score}`, 300, canvas.height - 280);
      ctx.fillText(`PLAYER: ${playerName}`, 900, canvas.height - 330);
      ctx.fillText(`SCORE: ${score}`, 900, canvas.height - 280);
    }
  } else {
    drawMultiLineText(settings.brandName, canvas.width / 2, 110, 64, 72);

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 38px JetBrains Mono, monospace";
    if (hideScoreFooter || score === null) {
      const caption = playerName ? `${playerName} · ${eventDate}` : eventDate;
      ctx.fillText(caption, canvas.width / 2, canvas.height - 210);
    } else {
      ctx.fillText(
        `PLAYER: ${playerName}  |  SCORE: ${score}`,
        canvas.width / 2,
        canvas.height - 210,
      );
    }
  }

  // Sponsors Flow
  const validSponsors = (settings.sponsorsUrls || []).filter((u) => Boolean(u));
  if (validSponsors.length > 0) {
    const sponsorImgs = await Promise.all(
      validSponsors.map((url) => loadImageSafe(url, 5000)),
    );

    const drawSponsorsRow = (xOffset: number, availableWidth: number) => {
      const imgSize = Math.min(180, (availableWidth - 80) / validSponsors.length);
      const startX =
        xOffset + (availableWidth - validSponsors.length * imgSize) / 2;
      const yPos = canvas.height - 165;

      sponsorImgs.forEach((sImg, i) => {
        if (sImg) {
          drawImageProp(
            ctx,
            sImg,
            startX + i * imgSize,
            yPos,
            imgSize - 20,
            90,
          );
        }
      });
    };

    if (isHalfStrips) {
      drawSponsorsRow(0, 600);
      drawSponsorsRow(600, 600);
    } else {
      drawSponsorsRow(0, canvas.width);
    }
  }

  try {
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch (err) {
    console.error("Canvas export error (likely CORS on custom asset):", err);
    return photos[0] || "";
  }
};

export async function compressDataUrlForCloud(
  dataUrl: string,
  maxChars = 680000,
): Promise<string> {
  if (dataUrl.length <= maxChars) return dataUrl;
  const img = await loadImageSafe(dataUrl, 5000);
  if (!img) return dataUrl.slice(0, maxChars);

  const canvas = document.createElement("canvas");
  let scale = 0.7;
  let quality = 0.72;

  for (let pass = 0; pass < 4; pass++) {
    canvas.width = Math.max(480, Math.round(img.width * scale));
    canvas.height = Math.max(480, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length <= maxChars) {
      return compressed;
    }
    scale *= 0.8;
    quality -= 0.1;
  }
  return canvas.toDataURL("image/jpeg", 0.5);
}
