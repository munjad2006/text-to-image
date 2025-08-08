import React, { useRef, useState } from "react";

/**
 * Stylish Text-to-Image generator (offline).
 * - Proper curved text spacing (measured per-char)
 * - Multi-color text gradient (2-3 stops)
 * - Contrast-aware text colors vs background
 * - Random rotation/curve, bigger sizes, download
 * - Tailwind UI preserved
 */
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("dark"); // theme state
  const canvasRef = useRef(null);

  const fonts = [
    '"Poppins", Arial, sans-serif',
    '"Montserrat", Arial, sans-serif',
    '"Arial Black", Gadget, sans-serif',
    '"Impact", Charcoal, sans-serif',
    '"Comic Sans MS", cursive, sans-serif',
    '"Georgia", serif',
    '"Courier New", Courier, monospace',
    '"Verdana", Geneva, sans-serif',
  ];

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  // Create HSL color string
  const hsl = (h, s, l) => `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

  // Choose random background HSL colors
  const pickBgColors = () => {
    const h1 = randInt(0, 360);
    const h2 = (h1 + randInt(20, 140)) % 360;
    const s1 = randInt(55, 95);
    const s2 = randInt(55, 95);
    const l1 = randInt(25, 60); // avoid extreme extremes
    const l2 = randInt(25, 60);
    return [{ h: h1, s: s1, l: l1 }, { h: h2, s: s2, l: l2 }];
  };

  // Decide text color light/dark based on avg background lightness,
  // then produce N text gradient colors (HSL) biased for contrast.
  const pickTextColorsForBg = (bgColors, n = 3) => {
    const avgL = (bgColors[0].l + bgColors[1].l) / 2;
    const baseHue = (bgColors[0].h + bgColors[1].h) / 2;
    const colors = [];
    if (avgL > 55) {
      // background is light -> choose darker text shades
      for (let i = 0; i < n; i++) {
        const hh = (baseHue + randInt(-60, 60) + 360) % 360;
        const ss = randInt(40, 85);
        const ll = randInt(8, 35); // dark
        colors.push({ h: hh, s: ss, l: ll });
      }
    } else {
      // background dark -> choose lighter text shades
      for (let i = 0; i < n; i++) {
        const hh = (baseHue + randInt(-60, 60) + 360) % 360;
        const ss = randInt(45, 95);
        const ll = randInt(68, 98); // light
        colors.push({ h: hh, s: ss, l: ll });
      }
    }
    return colors;
  };

  // Convert HSL object to CSS string
  const colorObjToCss = (c) => hsl(c.h, c.s, c.l);

  // Draw text along an arc with correct spacing
  function drawTextOnArc(ctx, text, cx, cy, radius, desiredArc, spacingFactor = 1.08) {
    // Measure each glyph
    const chars = text.split("");
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    // Apply spacing factor so letters don't tightly touch
    const adjWidths = widths.map((w) => w * spacingFactor);
    const sumWidth = adjWidths.reduce((a, b) => a + b, 0);

    // If sumWidth is zero fallback
    if (sumWidth <= 0) {
      ctx.fillText(text, cx, cy);
      return;
    }

    // If radius not matching desiredArc, we already passed desiredArc
    // desiredArc should be >0; compute radius so that arc covers desiredArc:
    // radius = arcLength / desiredArc
    const radiusComputed = sumWidth / desiredArc;

    let startAngle = -desiredArc / 2; // center the arc horizontally
    let curr = 0;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < chars.length; i++) {
      const w = adjWidths[i];
      const charAngle = w / radiusComputed; // angle occupied by char
      const angle = startAngle + curr + charAngle / 2;

      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -radiusComputed);

      // Draw char centered at this rotated position
      ctx.fillText(chars[i], 0, 0);
      // Add a subtle stroke for readability
      ctx.lineWidth = Math.max(1, ctx.fontSize * 0.06 || 2);
      try {
        ctx.strokeText(chars[i], 0, 0);
      } catch (e) {
        // some browsers may not expose ctx.fontSize — safe fallback no stroke
      }
      ctx.restore();

      curr += charAngle;
    }

    ctx.restore();
  }

  // Helper: draw centered rotated straight text
  function drawCenteredRotatedText(ctx, text, cx, cy, fontSize, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillText(text, 0, 0);
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.06));
    ctx.strokeText(text, 0, 0);
    ctx.restore();
  }

  const generateImage = () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setImageUrl("");
    setTimeout(() => {
      try {
        const canvas = canvasRef.current;
        // High-res canvas for better download quality
        const width = 1400;
        const height = 900;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Background gradient
        const bg = pickBgColors();
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, colorObjToCss(bg[0]));
        bgGrad.addColorStop(1, colorObjToCss(bg[1]));
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Pick text colors (2 or 3 stops)
        const stops = 2 + randInt(0, 1); // 2 or 3
        const textColorObjs = pickTextColorsForBg(bg, stops);

        // build a horizontal gradient for text
        const textGrad = ctx.createLinearGradient(width * 0.1, 0, width * 0.9, 0);
        for (let i = 0; i < textColorObjs.length; i++) {
          textGrad.addColorStop(i / (textColorObjs.length - 1 || 1), colorObjToCss(textColorObjs[i]));
        }

        // Random font & size (larger)
        const fontFamily = fonts[randInt(0, fonts.length - 1)];
        const fontSize = Math.round(randInt(70, 140) * 1.2); // 35% larger text
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        // store fontSize on context for strokes fallback
        ctx.fontSize = fontSize;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Shadow for readability (choose black/white depending on bg avg L)
        const avgBgL = (bg[0].l + bg[1].l) / 2;
        const shadowIsLight = avgBgL < 55; // if bg dark -> light shadow
        ctx.shadowColor = shadowIsLight ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)";
        ctx.shadowBlur = Math.round(fontSize * 0.12);

        // Use text gradient
        ctx.fillStyle = textGrad;

        // Stroke style: contrast outline
        ctx.strokeStyle = avgBgL > 55 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)";

        // Choose curvature or straight + slight rotation randomly
        const useCurve = Math.random() > 0.35; // 65% curve, 35% straight
        const rotateAngle = rand(-0.35, 0.35); // small rotation -20°..20°
        // If curved, pick desired arc angle between ~100° to ~210° in radians
        const desiredArc = rand(Math.PI * 0.55, Math.PI * 0.95);

        // Slightly adjust radius by font size
        if (useCurve) {
          // Place arc centered near top half (like a banner) or middle random
          const radius = null; // radius will be computed inside drawTextOnArc via desiredArc
          // We'll draw the curved text centered horizontally and at y near 40% height
          const cx = width / 2;
          const cy = height / 2 - rand(-20, 40); // small vertical jitter

          // For better visuals, increase spacing a bit more for curved text if long
          const spacingFactor = prompt.length > 20 ? 1.14 : rand(1.06, 1.18);

          // rotate the whole arc slightly if desired (we rotate inside drawTextOnArc by rotating context)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotateAngle);
          // Since drawTextOnArc expects to translate itself, we pass 0,0 as center
          // Setup fill and stroke and then call a wrapper that rotates per-character
          // But our drawTextOnArc translates again; adapt by using center 0,0:
          // So call drawTextOnArc with center 0,0 and then restore.
          // However our function expects absolute center; we'll instead call an inner function here

          // Prepare context for measuring widths: measurement should be done with same font
          const chars = prompt.split("");
          const widths = chars.map((ch) => ctx.measureText(ch).width);
          const adjWidths = widths.map((w) => w * spacingFactor);
          const sumWidth = adjWidths.reduce((a, b) => a + b, 0);
          // Ensure desiredArc not too small or big
          const desiredArcClamped = Math.max(Math.min(desiredArc, Math.PI * 1.5), Math.PI * 0.3);
          const radiusComputed = Math.max((sumWidth / desiredArcClamped), fontSize * 1.1);

          // Now draw each char around arc (centered)
          const startAngle = -desiredArcClamped / 2;
          let curr = 0;
          for (let i = 0; i < chars.length; i++) {
            const w = adjWidths[i];
            const charAngle = w / radiusComputed;
            const angle = startAngle + curr + charAngle / 2;

            ctx.save();
            ctx.rotate(angle);
            ctx.translate(0, -radiusComputed);
            ctx.fillText(chars[i], 0, 0);
            ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));
            ctx.strokeText(chars[i], 0, 0);
            ctx.restore();

            curr += charAngle;
          }

          ctx.restore();
        } else {
          // Straight centered text with rotation; may be multi-line wrap if too long
          const cx = width / 2;
          const cy = height / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotateAngle);

          // Simple wrapping logic for straight text (split into lines if too long)
          const maxWidth = width * 0.8;
          const words = prompt.split(" ");
          const lines = [];
          let currentLine = "";
          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine ? currentLine + " " + words[i] : words[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);

          const lineHeight = fontSize * 1.12;
          const startY = -((lines.length - 1) * lineHeight) / 2;
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 0, startY + i * lineHeight);
            ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));
            ctx.strokeText(lines[i], 0, startY + i * lineHeight);
          }

          ctx.restore();
        }

        // Convert canvas to data URL
        const url = canvas.toDataURL("image/png");
        setImageUrl(url);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 120); // small delay so UI updates
  };

  // Download handler
  const downloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "stylish-text.png";
    link.click();
  };

  // Theme colors
  const themeClasses =
    theme === "dark"
      ? "bg-[#0f172a] text-white"
      : "bg-gray-100 text-gray-900";

  const cardClasses =
    theme === "dark"
      ? "bg-gray-800"
      : "bg-white border border-gray-300";

  const inputClasses =
    theme === "dark"
      ? "bg-gray-700 text-white"
      : "bg-gray-200 text-gray-900";

  const placeholderColor =
    theme === "dark"
      ? "placeholder-gray-400"
      : "placeholder-gray-500";

  return (
    <div className={`min-h-screen ${themeClasses} flex flex-col items-center p-6 transition-colors duration-300`}>
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center my-8 flex flex-col items-center gap-2">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            High-Contrast Stylish Text-to-Image
          </h1>
          <p className={theme === "dark" ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>
            Readable text, random styles, full offline.
          </p>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`mt-3 px-4 py-2 rounded-lg font-semibold border transition-colors duration-200 ${theme === "dark"
                ? "bg-gray-900 text-white border-gray-700 hover:bg-gray-700"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-200"
              }`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
          </button>
        </header>

        <main>
          <div className={`${cardClasses} rounded-xl shadow-lg p-6 transition-colors duration-300`}>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a creative description..."
                className={`flex-grow rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:outline-none transition duration-300 ${inputClasses} ${placeholderColor}`}
                onKeyDown={(e) => e.key === "Enter" && generateImage()}
              />
              <button
                onClick={generateImage}
                disabled={loading || !prompt.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate Image"
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            {loading ? (
              <div className={`w-full h-96 ${cardClasses} rounded-lg flex items-center justify-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <p>Your stylish image is being created...</p>
              </div>
            ) : imageUrl ? (
              <div className="w-full max-w-lg flex flex-col items-center">
                <img src={imageUrl} alt="Generated visualization" className="rounded-lg shadow-2xl w-full h-auto" />
                <div className="mt-4 flex gap-3">
                  <button onClick={downloadImage} className="bg-pink-500 px-4 py-2 rounded hover:bg-pink-600 text-white">
                    Download Image
                  </button>
                  <button
                    onClick={() => {
                      // regenerate new random style but same text quickly
                      setLoading(true);
                      setTimeout(() => {
                        generateImage();
                      }, 80);
                    }}
                    className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 text-white"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <div className={`w-full h-96 ${cardClasses} rounded-lg flex items-center justify-center ${theme === "dark" ? "text-gray-400 border-2 border-dashed border-gray-600" : "text-gray-500 border-2 border-dashed border-gray-300"}`}>
                <p>Your generated image will appear here.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
